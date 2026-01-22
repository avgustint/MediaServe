const http = require('http');
const path = require('path');

/**
 * OS-level keyboard listener service
 * Captures arrow keys, number keys, and Enter key
 * Sends keyboard commands to server via HTTP POST
 */

// Configuration: Get port from environment variable, config.js, or default to 8080
let serverPort = process.env.PORT;
if (!serverPort) {
  try {
    // Try to load config.js if available (when running in server directory context)
    const configPath = path.join(__dirname, '../config.js');
    const config = require(configPath);
    serverPort = config.port;
  } catch (error) {
    // Config not available, use default
    serverPort = 8080;
  }
}
// Ensure port is a number
serverPort = parseInt(serverPort, 10) || 8080;

const SERVER_URL = `http://localhost:${serverPort}`;
const KEYBOARD_ENDPOINT = '/api/keyboard/command';

// Key code mappings for arrow keys, numbers, and Enter
const KEY_MAPPINGS = {
  // Arrow keys (from /usr/include/linux/input-event-codes.h)
  103: 'ArrowUp',      // KEY_UP
  108: 'ArrowDown',    // KEY_DOWN
  105: 'ArrowLeft',    // KEY_LEFT
 106: 'ArrowRight',    // KEY_RIGHT
  28: 'Enter',         // KEY_ENTER
  // Number keys (top row)
  2: '1',
  3: '2',
  4: '3',
  5: '4',
  6: '5',
  7: '6',
  8: '7',
  9: '8',
  10: '9',
  11: '0',
  // Numeric keypad keys (work regardless of Num Lock state)
  79: '1',             // KEY_KP1
  80: '2',             // KEY_KP2
  81: '3',             // KEY_KP3
  75: '4',             // KEY_KP4
  76: '5',             // KEY_KP5
  77: '6',             // KEY_KP6
  71: '7',             // KEY_KP7
  72: '8',             // KEY_KP8
  73: '9',             // KEY_KP9
  82: '0',             // KEY_KP0
  83: 'Enter'          // KEY_KPENTER
};

let listening = false;
let inputDevice = null;

/**
 * Send keyboard command to server
 */
function sendKeyboardCommand(key) {
  const postData = JSON.stringify({
    key: key,
    timestamp: Date.now()
  });

  const options = {
    hostname: 'localhost',
    port: serverPort,
    path: KEYBOARD_ENDPOINT,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log(`Keyboard command '${key}' sent successfully`);
      } else {
        console.error(`Failed to send keyboard command '${key}':`, res.statusCode, data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error sending keyboard command:', error.message);
  });

  req.write(postData);
  req.end();
}

/**
 * Read keyboard events from /dev/input/event* (Linux)
 * This is a simple implementation that tries common input devices
 */
function listenToKeyboardLinux() {
  const fs = require('fs');
  
  // Try to find keyboard input device
  // Common locations: /dev/input/event0, /dev/input/event1, etc.
  const possibleDevices = [
    '/dev/input/event0',
    '/dev/input/event1',
    '/dev/input/event2',
    '/dev/input/event3'
  ];

  for (const devicePath of possibleDevices) {
    try {
      // Check if device exists and is readable
      fs.accessSync(devicePath, fs.constants.R_OK);
      
      console.log(`Attempting to read from ${devicePath}`);
      
      // Read from device (requires root or proper permissions)
      const fd = fs.openSync(devicePath, 'r');
      const buffer = Buffer.alloc(24); // input_event struct size
      
      let lastKeyCode = null;
      let lastKeyTime = 0;
      const DEBOUNCE_TIME = 100; // milliseconds
      
      const readEvent = () => {
        try {
          const bytesRead = fs.readSync(fd, buffer, 0, 24, null);
          
          if (bytesRead === 24) {
            // Parse input_event structure:
            // struct input_event {
            //   struct timeval time;  // 16 bytes (8 bytes sec, 8 bytes usec)
            //   __u16 type;           // 2 bytes
            //   __u16 code;           // 2 bytes
            //   __s32 value;          // 4 bytes
            // };
            
            const type = buffer.readUInt16LE(16);
            const code = buffer.readUInt16LE(18);
            const value = buffer.readInt32LE(20);
            
            // EV_KEY = 1, KEY event
            if (type === 1 && value === 1) { // Key press (not release)
              const now = Date.now();
              
              // Debounce: ignore same key within DEBOUNCE_TIME
              if (code !== lastKeyCode || (now - lastKeyTime) > DEBOUNCE_TIME) {
                const keyName = KEY_MAPPINGS[code];
                if (keyName) {
                  console.log(`Key pressed: ${keyName} (code: ${code})`);
                  sendKeyboardCommand(keyName);
                }
                lastKeyCode = code;
                lastKeyTime = now;
              }
            }
          }
          
          // Continue reading
          setImmediate(readEvent);
        } catch (error) {
          if (error.code !== 'EAGAIN' && error.code !== 'EWOULDBLOCK') {
            console.error(`Error reading from ${devicePath}:`, error.message);
            // Try next device or exit
            setTimeout(() => {
              if (listening) {
                listenToKeyboardLinux();
              }
            }, 1000);
            return;
          }
          // EAGAIN means no data available, continue reading
          setImmediate(readEvent);
        }
      };
      
      readEvent();
      inputDevice = devicePath;
      console.log(`Successfully listening to keyboard events from ${devicePath}`);
      return; // Success, exit loop
    } catch (error) {
      // Device not accessible or doesn't exist, try next
      continue;
    }
  }
  
  console.error('Could not find accessible keyboard input device.');
  console.error('Note: This service requires root permissions or proper udev rules.');
  console.error('Alternative: Use ioHook library (npm install iohook) for cross-platform support.');
}

/**
 * Start listening to keyboard events
 */
function startListening() {
  if (listening) {
    console.log('Keyboard listener already running');
    return;
  }

  listening = true;
  console.log('Starting OS-level keyboard listener...');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log('Listening for: Arrow keys, Number keys (0-9), Enter key');

  // Try to use ioHook first (if available)
  try {
    const iohook = require('iohook');
    
    console.log('Using ioHook library for keyboard listening');
    
    iohook.on('keydown', (event) => {
      const keyName = KEY_MAPPINGS[event.rawcode] || 
                     (event.rawcode >= 2 && event.rawcode <= 11 ? KEY_MAPPINGS[event.rawcode] : null);
      
      if (keyName) {
        console.log(`Key pressed: ${keyName}`);
        sendKeyboardCommand(keyName);
      }
    });
    
    iohook.start();
    console.log('ioHook keyboard listener started');
  } catch (error) {
    // ioHook not available, use Linux /dev/input
    console.log('ioHook not available, trying Linux /dev/input method...');
    listenToKeyboardLinux();
  }
}

/**
 * Stop listening to keyboard events
 */
function stopListening() {
  listening = false;
  console.log('Stopping keyboard listener...');
  
  // If using ioHook, stop it
  try {
    const iohook = require('iohook');
    if (iohook) {
      iohook.stop();
    }
  } catch (error) {
    // ioHook not available or not started
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down...');
  stopListening();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down...');
  stopListening();
  process.exit(0);
});

// Start listening if this file is run directly
if (require.main === module) {
  startListening();
}

module.exports = {
  startListening,
  stopListening
};

