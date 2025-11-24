import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type SupportedLocale = 'sl-SI' | 'en-GB' | 'it-IT';

export interface TranslationKeys {
  // Login
  login: string;
  username: string;
  password: string;
  invalidCredentials: string;
  loginFailed: string;
  
  // App Navigation
  mediaPlayerAdmin: string;
  playlist: string;
  editor: string;
  settings: string;
  display: string;
  logout: string;
  confirmLogout: string;
  logoutConfirmMessage: string;
  connected: string;
  connecting: string;
  disconnected: string;
  
  // Playlist
  manual: string;
  clear: string;
  previous: string;
  next: string;
  currentLibraryItemDetails: string;
  noItemSelected: string;
  
  // Editor
  library: string;
  playlistEditor: string;
  searchLibraryItems: string;
  searchPlaylists: string;
  addNewLibraryItem: string;
  addNewPlaylist: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  name: string;
  description: string;
  type: string;
  content: string;
  text: string;
  image: string;
  url: string;
  page: string;
  pages: string;
  addPage: string;
  removePage: string;
  uploadImage: string;
  noResults: string;
  noLibraryItemsFound: string;
  confirmDelete: string;
  confirmDeleteMessage: string;
  libraryItemDeleted: string;
  playlistDeleted: string;
  errorDeletingItem: string;
  itemUsedInPlaylists: string;
  cannotDeleteItem: string;
  
  // Settings
  users: string;
  rolesPermissions: string;
  addNewUser: string;
  editUser: string;
  email: string;
  role: string;
  locale: string;
  selectRole: string;
  selectLocale: string;
  slovenian: string;
  ukEnglish: string;
  italian: string;
  passwordLeaveBlank: string;
  emailRequired: string;
  invalidEmail: string;
  roleRequired: string;
  localeRequired: string;
  passwordRequired: string;
  nameRequired: string;
  usernameRequired: string;
  userSaved: string;
  errorSavingUser: string;
  cannotModifyAdminRole: string;
  cannotDeleteAdmin: string;
  administratorRoleCannotBeModified: string;
  
  // Common
  confirm: string;
  close: string;
  search: string;
  clearSearch: string;
  select: string;
  no: string;
  yes: string;
  
  // Errors
  error: string;
  errorOccurred: string;
  pleaseTryAgain: string;
  
  // Additional UI Elements
  waitingForContent: string;
  noLibraryItemFoundWithId: string;
  clearId: string;
  deleteLastDigit: string;
  enter: string;
  goToPage: string;
  toggleSidebar: string;
  closeSidebar: string;
  typeColon: string;
  permission: string;
  permissions: string;
  readOnly: string;
  savePermissions: string;
  selectRoleToEdit: string;
  permissionsFor: string;
  noRoleSelected: string;
  enterItemName: string;
  enterItemDescription: string;
  enterPlaylistName: string;
  enterPlaylistDescription: string;
  enterUserName: string;
  enterUserEmail: string;
  enterUserUsername: string;
  enterPassword: string;
  enterContentForPage: string;
  enterUrl: string;
  searchLibraryItemsToAdd: string;
  pagesLeaveEmpty: string;
  selectAll: string;
  clearAllPages: string;
  noItemsInPlaylist: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  deleteUser: string;
  deletePlaylist: string;
  deleteItem: string;
  recentlyModified: string;
  modified: string;
  selectPlaylist: string;
  noPlaylistsFound: string;
  libraryItems: string;
  nameAndEmailAndUsernameRequired: string;
  pleaseSelectValidLibraryItem: string;
    pleaseEnterNameForPlaylist: string;
    itemUsedInPlaylistsDetail: string;
    loadingPlaylist: string;
    editLibraryItem: string;
    contentPages: string;
    imageFile: string;
    preview: string;
    item: string;
    editPlaylist: string;
    updated: string;
    selected: string;
    descriptionOptional: string;
    ok: string;
    noRole: string;
    permissionCount: string;
    cannotModifyPermissionsForAdminRole: string;
    errorLoadingData: string;
    errorSavingRolePermissions: string;
    roles: string;
    permissionsCount: string;
    rolePermissionsUpdated: string;
    deleteUserConfirm: string;
    thisActionCannotBeUndone: string;
    searchUsersPlaceholder: string;
    searchRolesPlaceholder: string;
    addNewRole: string;
    editRole: string;
    roleSaved: string;
    errorSavingRole: string;
    deleteRole: string;
    deleteRoleConfirm: string;
    cannotDeleteAdminRole: string;
    roleUsedByUsers: string;
    errorDeletingRole: string;
    enterRoleName: string;
    isAdminRole: string;
    adminRoleNameOnlyEditable: string;
    adminRole: string;
    noRolesFound: string;
    
    // User Profile
    userProfile: string;
    editProfile: string;
    changePassword: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    usernameCannotBeChanged: string;
    passwordsDoNotMatch: string;
    passwordTooShort: string;
    invalidCurrentPassword: string;
    errorChangingPassword: string;
    enterCurrentPassword: string;
    enterNewPassword: string;
    enterConfirmPassword: string;
    noLocale: string;
}

const translations: Record<SupportedLocale, TranslationKeys> = {
  'en-GB': {
    // Login
    login: 'Login',
    username: 'Username',
    password: 'Password',
    invalidCredentials: 'Invalid username or password',
    loginFailed: 'Login failed. Please try again.',
    
    // App Navigation
    mediaPlayerAdmin: 'Media Player Admin',
    playlist: 'Playlist',
    editor: 'Editor',
    settings: 'Settings',
    display: 'Display',
    logout: 'Logout',
    confirmLogout: 'Confirm Logout',
    logoutConfirmMessage: 'Are you sure you want to logout?',
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    
    // Playlist
    manual: 'Manual',
    clear: 'Clear',
    previous: 'Previous',
    next: 'Next',
    currentLibraryItemDetails: 'Current library item details:',
    noItemSelected: 'No item selected',
    
    // Editor
    library: 'Library',
    playlistEditor: 'Playlist',
    searchLibraryItems: 'Search library items...',
    searchPlaylists: 'Search playlists...',
    addNewLibraryItem: 'Add New Library Item',
    addNewPlaylist: 'Add New Playlist',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    name: 'Name',
    description: 'Description',
    type: 'Type',
    content: 'Content',
    text: 'text',
    image: 'image',
    url: 'url',
    page: 'Page',
    pages: 'Pages',
    addPage: 'Add Page',
    removePage: 'Remove Page',
    uploadImage: 'Upload Image',
    noResults: 'No results',
    noLibraryItemsFound: 'No library items found',
    confirmDelete: 'Confirm Delete',
    confirmDeleteMessage: 'Are you sure you want to delete this item? This action cannot be undone.',
    libraryItemDeleted: 'Library item deleted successfully',
    playlistDeleted: 'Playlist deleted successfully',
    errorDeletingItem: 'Error deleting item. Please try again.',
    itemUsedInPlaylists: 'Item is used in playlists',
    cannotDeleteItem: 'Cannot delete this item',
    rolePermissionsUpdated: 'Role permissions updated successfully!',
    
    // Settings
    users: 'Users',
    rolesPermissions: 'Roles & Permissions',
    addNewUser: 'Add New User',
    editUser: 'Edit User',
    email: 'Email',
    role: 'Role',
    locale: 'Locale',
    selectRole: 'Select a role',
    selectLocale: 'Select a locale',
    slovenian: 'Slovenian',
    ukEnglish: 'UK (English)',
    italian: 'Italian',
    passwordLeaveBlank: 'Password (leave blank to keep current)',
    emailRequired: 'Email is required.',
    invalidEmail: 'Please enter a valid email address.',
    roleRequired: 'Role is required.',
    localeRequired: 'Locale is required.',
    passwordRequired: 'Password is required for new users.',
    nameRequired: 'Name is required.',
    usernameRequired: 'Username is required.',
    userSaved: 'User saved successfully',
    errorSavingUser: 'Error saving user. Please try again.',
    cannotModifyAdminRole: 'Only administrators can modify administrator roles.',
    cannotDeleteAdmin: 'Only administrators can delete other administrators.',
    administratorRoleCannotBeModified: 'Administrator role cannot be modified',
    
    // Common
    confirm: 'Confirm',
    close: 'Close',
    search: 'Search',
    clearSearch: 'Clear search',
    select: 'Select',
    no: 'No',
    yes: 'Yes',
    
    // Errors
    error: 'Error',
    errorOccurred: 'An error occurred',
    pleaseTryAgain: 'Please try again.',
    
    // Additional UI Elements
    waitingForContent: 'Waiting for content from WebSocket...',
    noLibraryItemFoundWithId: 'No library item found with ID:',
    clearId: 'Clear ID',
    deleteLastDigit: 'Delete last digit',
    enter: 'Enter',
    goToPage: 'Go to page',
    toggleSidebar: 'Toggle sidebar',
    closeSidebar: 'Close sidebar',
    typeColon: 'Type:',
    permission: 'Permission',
    permissions: 'Permissions',
    readOnly: 'Read Only',
    savePermissions: 'Save Permissions',
    selectRoleToEdit: 'Select a role to edit its permissions',
    permissionsFor: 'Permissions for:',
    noRoleSelected: 'Select a role to edit its permissions',
    enterItemName: 'Enter item name',
    enterItemDescription: 'Enter item description (optional)',
    enterPlaylistName: 'Enter playlist name',
    enterPlaylistDescription: 'Enter playlist description (optional)',
    enterUserName: 'Enter user name',
    enterUserEmail: 'Enter email address',
    enterUserUsername: 'Enter username',
    enterPassword: 'Enter password',
    enterContentForPage: 'Enter content for page',
    enterUrl: 'Enter URL (e.g., https://example.com)',
    searchLibraryItemsToAdd: 'Search library items to add...',
    pagesLeaveEmpty: 'Pages (leave empty for all pages):',
    selectAll: 'Select All',
    clearAllPages: 'Clear (All Pages)',
    noItemsInPlaylist: 'No items in playlist. Add library items above.',
    moveUp: 'Move up',
    moveDown: 'Move down',
    remove: 'Remove',
    deleteUser: 'Delete User',
    deletePlaylist: 'Delete Playlist',
    deleteItem: 'Delete item',
    recentlyModified: 'Recently Modified (Last 50)',
    modified: 'Modified:',
    selectPlaylist: 'Select a playlist',
    noPlaylistsFound: 'No playlists found',
    libraryItems: 'Library Items',
    nameAndEmailAndUsernameRequired: 'Name, Email, and Username are required.',
    pleaseSelectValidLibraryItem: 'Please select a valid library item',
    pleaseEnterNameForPlaylist: 'Please enter a name for the playlist',
    itemUsedInPlaylistsDetail: 'Item is used in the following playlist(s):',
    loadingPlaylist: 'Loading playlist...',
    editLibraryItem: 'Edit Library Item',
    contentPages: 'Content Pages',
    imageFile: 'Image File',
    preview: 'Preview',
    item: 'Item',
    editPlaylist: 'Edit Playlist',
    updated: 'Updated',
    selected: 'Selected',
    descriptionOptional: 'Description (optional)',
    ok: 'OK',
    roles: 'Roles',
    noRole: 'No Role',
    permissionsCount: 'permission(s)',
    permissionCount: 'permission(s)',
    deleteUserConfirm: 'Are you sure you want to delete user',
    thisActionCannotBeUndone: 'This action cannot be undone.',
    searchUsersPlaceholder: 'Search users by name, email, or username...',
    errorLoadingData: 'Error loading data. Please try again.',
    errorSavingRolePermissions: 'Error saving role permissions. Please try again.',
    cannotModifyPermissionsForAdminRole: 'Cannot modify permissions for the administrator role.',
    searchRolesPlaceholder: 'Search roles...',
    addNewRole: 'Add New Role',
    editRole: 'Edit Role',
    roleSaved: 'Role saved successfully',
    errorSavingRole: 'Error saving role. Please try again.',
    deleteRole: 'Delete Role',
    deleteRoleConfirm: 'Are you sure you want to delete role',
    cannotDeleteAdminRole: 'Cannot delete administrator role.',
    roleUsedByUsers: 'Role is used by one or more users and cannot be deleted.',
    errorDeletingRole: 'Error deleting role. Please try again.',
    enterRoleName: 'Enter role name',
    isAdminRole: 'Is Administrator Role',
    adminRoleNameOnlyEditable: 'For administrator roles, only the name can be edited.',
    adminRole: 'Admin Role',
    noRolesFound: 'No roles found',
    
    // User Profile
    userProfile: 'User Profile',
    editProfile: 'Edit Profile',
    changePassword: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    usernameCannotBeChanged: 'Username cannot be changed',
    passwordsDoNotMatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters long',
    invalidCurrentPassword: 'Invalid current password',
    errorChangingPassword: 'Error changing password. Please try again.',
    enterCurrentPassword: 'Enter current password',
    enterNewPassword: 'Enter new password',
    enterConfirmPassword: 'Confirm new password',
    noLocale: 'No locale'
  },
  'sl-SI': {
    // Login
    login: 'Prijava',
    username: 'Uporabniško ime',
    password: 'Geslo',
    invalidCredentials: 'Napačno uporabniško ime ali geslo',
    loginFailed: 'Prijava ni uspela. Poskusite znova.',
    
    // App Navigation
    mediaPlayerAdmin: 'Upravljalec Medijskega Predvajalnika',
    playlist: 'Seznam Predvajanja',
    editor: 'Urejevalnik',
    settings: 'Nastavitve',
    display: 'Zaslon',
    logout: 'Odjava',
    confirmLogout: 'Potrditev Odjave',
    logoutConfirmMessage: 'Ali ste prepričani, da se želite odjaviti?',
    connected: 'Povezano',
    connecting: 'Povezovanje...',
    disconnected: 'Ni povezano',
    
    // Playlist
    manual: 'Ročno',
    clear: 'Počisti',
    previous: 'Nazaj',
    next: 'Naprej',
    currentLibraryItemDetails: 'Podrobnosti trenutne knjižnične postavke:',
    noItemSelected: 'Nobena postavka ni izbrana',
    
    // Editor
    library: 'Knjižnica',
    playlistEditor: 'Seznam Predvajanja',
    searchLibraryItems: 'Iskanje knjižničnih postavk...',
    searchPlaylists: 'Iskanje seznamov predvajanja...',
    addNewLibraryItem: 'Dodaj Novo Knjižnično Postavko',
    addNewPlaylist: 'Dodaj Nov Seznam Predvajanja',
    save: 'Shrani',
    cancel: 'Prekliči',
    delete: 'Izbriši',
    edit: 'Uredi',
    name: 'Ime',
    description: 'Opis',
    type: 'Vrsta',
    content: 'Vsebina',
    text: 'besedilo',
    image: 'slika',
    url: 'url',
    page: 'Stran',
    pages: 'Strani',
    addPage: 'Dodaj Stran',
    removePage: 'Odstrani Stran',
    uploadImage: 'Naloži Sliko',
    noResults: 'Ni rezultatov',
    noLibraryItemsFound: 'Ni najdenih knjižničnih postavk',
    confirmDelete: 'Potrditev Brisanja',
    confirmDeleteMessage: 'Ali ste prepričani, da želite izbrisati to postavko? To dejanje ni mogoče razveljaviti.',
    libraryItemDeleted: 'Knjižnična postavka je bila uspešno izbrisana',
    playlistDeleted: 'Seznam predvajanja je bil uspešno izbrisan',
    errorDeletingItem: 'Napaka pri brisanju postavke. Poskusite znova.',
    itemUsedInPlaylists: 'Postavka se uporablja v seznamih predvajanja',
    cannotDeleteItem: 'Te postavke ni mogoče izbrisati',
    rolePermissionsUpdated: 'Dovoljenja vlog so bila uspešno posodobljena!',
    
    // Settings
    users: 'Uporabniki',
    rolesPermissions: 'Vloge in Dovoljenja',
    addNewUser: 'Dodaj Novega Uporabnika',
    editUser: 'Uredi Uporabnika',
    email: 'E-pošta',
    role: 'Vloga',
    locale: 'Jezik',
    selectRole: 'Izberite vlogo',
    selectLocale: 'Izberite jezik',
    slovenian: 'Slovenski',
    ukEnglish: 'Angleški (UK)',
    italian: 'Italijanski',
    passwordLeaveBlank: 'Geslo (pustite prazno za ohranitev trenutnega)',
    emailRequired: 'E-pošta je obvezna.',
    invalidEmail: 'Vnesite veljavni e-poštni naslov.',
    roleRequired: 'Vloga je obvezna.',
    localeRequired: 'Jezik je obvezen.',
    passwordRequired: 'Geslo je obvezno za nove uporabnike.',
    nameRequired: 'Ime je obvezno.',
    usernameRequired: 'Uporabniško ime je obvezno.',
    userSaved: 'Uporabnik je bil uspešno shranjen',
    errorSavingUser: 'Napaka pri shranjevanju uporabnika. Poskusite znova.',
    cannotModifyAdminRole: 'Samo administratorji lahko spreminjajo vloge administratorjev.',
    cannotDeleteAdmin: 'Samo administratorji lahko brišejo druge administratorje.',
    administratorRoleCannotBeModified: 'Vloge administratorja ni mogoče spremeniti',
    
    // Common
    confirm: 'Potrdi',
    close: 'Zapri',
    search: 'Iskanje',
    clearSearch: 'Počisti iskanje',
    select: 'Izberi',
    no: 'Ne',
    yes: 'Da',
    
    // Errors
    error: 'Napaka',
    errorOccurred: 'Prišlo je do napake',
    pleaseTryAgain: 'Poskusite znova.',
    
    // Additional UI Elements
    waitingForContent: 'Čakanje na vsebino iz WebSocket...',
    noLibraryItemFoundWithId: 'Ni najdene knjižnične postavke z ID:',
    clearId: 'Počisti ID',
    deleteLastDigit: 'Izbriši zadnjo številko',
    enter: 'Vnesi',
    goToPage: 'Pojdi na stran',
    toggleSidebar: 'Preklopi stransko vrstico',
    closeSidebar: 'Zapri stransko vrstico',
    typeColon: 'Vrsta:',
    permission: 'Dovoljenje',
    permissions: 'Dovoljenja',
    readOnly: 'Samo za branje',
    savePermissions: 'Shrani Dovoljenja',
    selectRoleToEdit: 'Izberite vlogo za urejanje dovoljenj',
    permissionsFor: 'Dovoljenja za:',
    noRoleSelected: 'Izberite vlogo za urejanje dovoljenj',
    enterItemName: 'Vnesite ime postavke',
    enterItemDescription: 'Vnesite opis postavke (neobvezno)',
    enterPlaylistName: 'Vnesite ime seznama predvajanja',
    enterPlaylistDescription: 'Vnesite opis seznama predvajanja (neobvezno)',
    enterUserName: 'Vnesite uporabniško ime',
    enterUserEmail: 'Vnesite e-poštni naslov',
    enterUserUsername: 'Vnesite uporabniško ime',
    enterPassword: 'Vnesite geslo',
    enterContentForPage: 'Vnesite vsebino za stran',
    enterUrl: 'Vnesite URL (npr., https://example.com)',
    searchLibraryItemsToAdd: 'Iskanje knjižničnih postavk za dodajanje...',
    pagesLeaveEmpty: 'Strani (pustite prazno za vse strani):',
    selectAll: 'Izberi Vse',
    clearAllPages: 'Počisti (Vse Strani)',
    noItemsInPlaylist: 'Ni postavk v seznamu predvajanja. Dodajte knjižnične postavke zgoraj.',
    moveUp: 'Premakni navzgor',
    moveDown: 'Premakni navzdol',
    remove: 'Odstrani',
    deleteUser: 'Izbriši Uporabnika',
    deletePlaylist: 'Izbriši Seznam Predvajanja',
    deleteItem: 'Izbriši postavko',
    recentlyModified: 'Nedavno Spremenjeno (Zadnjih 50)',
    modified: 'Spremenjeno:',
    selectPlaylist: 'Izberite seznam predvajanja',
    noPlaylistsFound: 'Ni najdenih seznamov predvajanja',
    libraryItems: 'Knjižnične Postavke',
    nameAndEmailAndUsernameRequired: 'Ime, E-pošta in Uporabniško ime so obvezni.',
    pleaseSelectValidLibraryItem: 'Prosimo, izberite veljavno knjižnično postavko',
    pleaseEnterNameForPlaylist: 'Prosimo, vnesite ime za seznam predvajanja',
    itemUsedInPlaylistsDetail: 'Postavka se uporablja v naslednjih seznamih predvajanja:',
    loadingPlaylist: 'Nalaganje seznama predvajanja...',
    editLibraryItem: 'Uredi Knjižnično Postavko',
    editPlaylist: 'Uredi Seznam Predvajanja',
    updated: 'Posodobljeno',
    selected: 'Izbrano',
    descriptionOptional: 'Opis (neobvezno)',
    ok: 'V redu',
    contentPages: 'Vsebinske Strani',
    imageFile: 'Slikovna Datoteka',
    preview: 'Predogled',
    item: 'Postavka',
    roles: 'Vloge',
    noRole: 'Brez vloge',
    permissionsCount: 'dovoljenj',
    permissionCount: 'dovoljenj',
    deleteUserConfirm: 'Ali ste prepričani, da želite izbrisati uporabnika',
    thisActionCannotBeUndone: 'Te akcije ni mogoče razveljaviti.',
    searchUsersPlaceholder: 'Iskanje uporabnikov po imenu, e-pošti ali uporabniškem imenu...',
    errorLoadingData: 'Napaka pri nalaganju podatkov. Prosimo, poskusite znova.',
    errorSavingRolePermissions: 'Napaka pri shranjevanju dovoljenj vloge. Prosimo, poskusite znova.',
    cannotModifyPermissionsForAdminRole: 'Dovoljenj vloge administratorja ni mogoče spremeniti.',
    searchRolesPlaceholder: 'Iskanje vlog...',
    addNewRole: 'Dodaj Novo Vlogo',
    editRole: 'Uredi Vlogo',
    roleSaved: 'Vloga je bila uspešno shranjena',
    errorSavingRole: 'Napaka pri shranjevanju vloge. Poskusite znova.',
    deleteRole: 'Izbriši Vlogo',
    deleteRoleConfirm: 'Ali ste prepričani, da želite izbrisati vlogo',
    cannotDeleteAdminRole: 'Vloge administratorja ni mogoče izbrisati.',
    roleUsedByUsers: 'Vloga se uporablja pri enem ali več uporabnikih in je ni mogoče izbrisati.',
    errorDeletingRole: 'Napaka pri brisanju vloge. Poskusite znova.',
    enterRoleName: 'Vnesite ime vloge',
    isAdminRole: 'Je Administratorska Vloga',
    adminRoleNameOnlyEditable: 'Za administratorske vloge je mogoče urejati samo ime.',
    adminRole: 'Administratorska Vloga',
    noRolesFound: 'Ni najdenih vlog',
    
    // User Profile
    userProfile: 'Uporabniški Profil',
    editProfile: 'Uredi Profil',
    changePassword: 'Spremeni Geslo',
    currentPassword: 'Trenutno Geslo',
    newPassword: 'Novo Geslo',
    confirmPassword: 'Potrdi Geslo',
    usernameCannotBeChanged: 'Uporabniškega imena ni mogoče spremeniti',
    passwordsDoNotMatch: 'Gesli se ne ujemata',
    passwordTooShort: 'Geslo mora biti dolgo vsaj 6 znakov',
    invalidCurrentPassword: 'Napačno trenutno geslo',
    errorChangingPassword: 'Napaka pri spreminjanju gesla. Prosimo, poskusite znova.',
    enterCurrentPassword: 'Vnesite trenutno geslo',
    enterNewPassword: 'Vnesite novo geslo',
    enterConfirmPassword: 'Potrdite novo geslo',
    noLocale: 'Brez jezika'
  },
  'it-IT': {
    // Login
    login: 'Accesso',
    username: 'Nome utente',
    password: 'Password',
    invalidCredentials: 'Nome utente o password non validi',
    loginFailed: 'Accesso fallito. Riprova.',
    
    // App Navigation
    mediaPlayerAdmin: 'Amministrazione Media Player',
    playlist: 'Playlist',
    editor: 'Editor',
    settings: 'Impostazioni',
    display: 'Visualizzazione',
    logout: 'Esci',
    confirmLogout: 'Conferma Uscita',
    logoutConfirmMessage: 'Sei sicuro di voler uscire?',
    connected: 'Connesso',
    connecting: 'Connessione...',
    disconnected: 'Disconnesso',
    
    // Playlist
    manual: 'Manuale',
    clear: 'Cancella',
    previous: 'Precedente',
    next: 'Successivo',
    currentLibraryItemDetails: 'Dettagli elemento biblioteca corrente:',
    noItemSelected: 'Nessun elemento selezionato',
    
    // Editor
    library: 'Biblioteca',
    playlistEditor: 'Playlist',
    searchLibraryItems: 'Cerca elementi biblioteca...',
    searchPlaylists: 'Cerca playlist...',
    addNewLibraryItem: 'Aggiungi Nuovo Elemento Biblioteca',
    addNewPlaylist: 'Aggiungi Nuova Playlist',
    save: 'Salva',
    cancel: 'Annulla',
    delete: 'Elimina',
    edit: 'Modifica',
    name: 'Nome',
    description: 'Descrizione',
    type: 'Tipo',
    content: 'Contenuto',
    text: 'testo',
    image: 'immagine',
    url: 'url',
    page: 'Pagina',
    pages: 'Pagine',
    addPage: 'Aggiungi Pagina',
    removePage: 'Rimuovi Pagina',
    uploadImage: 'Carica Immagine',
    noResults: 'Nessun risultato',
    noLibraryItemsFound: 'Nessun elemento biblioteca trovato',
    confirmDelete: 'Conferma Eliminazione',
    confirmDeleteMessage: 'Sei sicuro di voler eliminare questo elemento? Questa azione non può essere annullata.',
    libraryItemDeleted: 'Elemento biblioteca eliminato con successo',
    playlistDeleted: 'Playlist eliminata con successo',
    errorDeletingItem: 'Errore durante l\'eliminazione. Riprova.',
    itemUsedInPlaylists: 'Elemento utilizzato in playlist',
    cannotDeleteItem: 'Impossibile eliminare questo elemento',
    rolePermissionsUpdated: 'Permessi ruolo aggiornati con successo!',
    
    // Settings
    users: 'Utenti',
    rolesPermissions: 'Ruoli e Permessi',
    addNewUser: 'Aggiungi Nuovo Utente',
    editUser: 'Modifica Utente',
    email: 'Email',
    role: 'Ruolo',
    locale: 'Lingua',
    selectRole: 'Seleziona un ruolo',
    selectLocale: 'Seleziona una lingua',
    slovenian: 'Sloveno',
    ukEnglish: 'Inglese (UK)',
    italian: 'Italiano',
    passwordLeaveBlank: 'Password (lascia vuoto per mantenere quella corrente)',
    emailRequired: 'Email obbligatoria.',
    invalidEmail: 'Inserisci un indirizzo email valido.',
    roleRequired: 'Ruolo obbligatorio.',
    localeRequired: 'Lingua obbligatoria.',
    passwordRequired: 'Password obbligatoria per i nuovi utenti.',
    nameRequired: 'Nome obbligatorio.',
    usernameRequired: 'Nome utente obbligatorio.',
    userSaved: 'Utente salvato con successo',
    errorSavingUser: 'Errore durante il salvataggio. Riprova.',
    cannotModifyAdminRole: 'Solo gli amministratori possono modificare i ruoli degli amministratori.',
    cannotDeleteAdmin: 'Solo gli amministratori possono eliminare altri amministratori.',
    administratorRoleCannotBeModified: 'Il ruolo amministratore non può essere modificato',
    
    // Common
    confirm: 'Conferma',
    close: 'Chiudi',
    search: 'Cerca',
    clearSearch: 'Cancella ricerca',
    select: 'Seleziona',
    no: 'No',
    yes: 'Sì',
    
    // Errors
    error: 'Errore',
    errorOccurred: 'Si è verificato un errore',
    pleaseTryAgain: 'Riprova.',
    
    // Additional UI Elements
    waitingForContent: 'In attesa di contenuto da WebSocket...',
    noLibraryItemFoundWithId: 'Nessun elemento biblioteca trovato con ID:',
    clearId: 'Cancella ID',
    deleteLastDigit: 'Elimina ultima cifra',
    enter: 'Invio',
    goToPage: 'Vai alla pagina',
    toggleSidebar: 'Attiva/disattiva barra laterale',
    closeSidebar: 'Chiudi barra laterale',
    typeColon: 'Tipo:',
    permission: 'Permesso',
    permissions: 'Permessi',
    readOnly: 'Sola Lettura',
    savePermissions: 'Salva Permessi',
    selectRoleToEdit: 'Seleziona un ruolo per modificare i permessi',
    permissionsFor: 'Permessi per:',
    noRoleSelected: 'Seleziona un ruolo per modificare i permessi',
    enterItemName: 'Inserisci nome elemento',
    enterItemDescription: 'Inserisci descrizione elemento (opzionale)',
    enterPlaylistName: 'Inserisci nome playlist',
    enterPlaylistDescription: 'Inserisci descrizione playlist (opzionale)',
    enterUserName: 'Inserisci nome utente',
    enterUserEmail: 'Inserisci indirizzo email',
    enterUserUsername: 'Inserisci nome utente',
    enterPassword: 'Inserisci password',
    enterContentForPage: 'Inserisci contenuto per pagina',
    enterUrl: 'Inserisci URL (es., https://example.com)',
    searchLibraryItemsToAdd: 'Cerca elementi biblioteca da aggiungere...',
    pagesLeaveEmpty: 'Pagine (lascia vuoto per tutte le pagine):',
    selectAll: 'Seleziona Tutto',
    clearAllPages: 'Cancella (Tutte le Pagine)',
    noItemsInPlaylist: 'Nessun elemento nella playlist. Aggiungi elementi biblioteca sopra.',
    moveUp: 'Sposta su',
    moveDown: 'Sposta giù',
    remove: 'Rimuovi',
    deleteUser: 'Elimina Utente',
    deletePlaylist: 'Elimina Playlist',
    deleteItem: 'Elimina elemento',
    recentlyModified: 'Modificati di Recente (Ultimi 50)',
    modified: 'Modificato:',
    selectPlaylist: 'Seleziona una playlist',
    noPlaylistsFound: 'Nessuna playlist trovata',
    libraryItems: 'Elementi Biblioteca',
    nameAndEmailAndUsernameRequired: 'Nome, Email e Nome utente sono obbligatori.',
    pleaseSelectValidLibraryItem: 'Seleziona un elemento biblioteca valido',
    pleaseEnterNameForPlaylist: 'Inserisci un nome per la playlist',
    itemUsedInPlaylistsDetail: 'Elemento utilizzato nelle seguenti playlist:',
    loadingPlaylist: 'Caricamento playlist...',
    editLibraryItem: 'Modifica Elemento Biblioteca',
    contentPages: 'Pagine Contenuto',
    imageFile: 'File Immagine',
    preview: 'Anteprima',
    item: 'Elemento',
    editPlaylist: 'Modifica Playlist',
    updated: 'Aggiornato',
    selected: 'Selezionato',
    descriptionOptional: 'Descrizione (opzionale)',
    ok: 'OK',
    roles: 'Ruoli',
    noRole: 'Nessun ruolo',
    permissionsCount: 'permesso/i',
    permissionCount: 'permesso/i',
    deleteUserConfirm: 'Sei sicuro di voler eliminare l\'utente',
    thisActionCannotBeUndone: 'Questa azione non può essere annullata.',
    searchUsersPlaceholder: 'Cerca utenti per nome, email o nome utente...',
    errorLoadingData: 'Errore nel caricamento dei dati. Riprova.',
    errorSavingRolePermissions: 'Errore nel salvare i permessi del ruolo. Riprova.',
    cannotModifyPermissionsForAdminRole: 'Non è possibile modificare i permessi del ruolo amministratore.',
    searchRolesPlaceholder: 'Cerca ruoli...',
    addNewRole: 'Aggiungi Nuovo Ruolo',
    editRole: 'Modifica Ruolo',
    roleSaved: 'Ruolo salvato con successo',
    errorSavingRole: 'Errore nel salvare il ruolo. Riprova.',
    deleteRole: 'Elimina Ruolo',
    deleteRoleConfirm: 'Sei sicuro di voler eliminare il ruolo',
    cannotDeleteAdminRole: 'Non è possibile eliminare il ruolo amministratore.',
    roleUsedByUsers: 'Il ruolo è utilizzato da uno o più utenti e non può essere eliminato.',
    errorDeletingRole: 'Errore nell\'eliminazione del ruolo. Riprova.',
    enterRoleName: 'Inserisci nome ruolo',
    isAdminRole: 'È Ruolo Amministratore',
    adminRoleNameOnlyEditable: 'Per i ruoli amministratore, è possibile modificare solo il nome.',
    adminRole: 'Ruolo Amministratore',
    noRolesFound: 'Nessun ruolo trovato',
    
    // User Profile
    userProfile: 'Profilo Utente',
    editProfile: 'Modifica Profilo',
    changePassword: 'Cambia Password',
    currentPassword: 'Password Attuale',
    newPassword: 'Nuova Password',
    confirmPassword: 'Conferma Password',
    usernameCannotBeChanged: 'Il nome utente non può essere modificato',
    passwordsDoNotMatch: 'Le password non corrispondono',
    passwordTooShort: 'La password deve essere lunga almeno 6 caratteri',
    invalidCurrentPassword: 'Password attuale non valida',
    errorChangingPassword: 'Errore durante la modifica della password. Riprova.',
    enterCurrentPassword: 'Inserisci password attuale',
    enterNewPassword: 'Inserisci nuova password',
    enterConfirmPassword: 'Conferma nuova password',
    noLocale: 'Nessuna lingua'
  }
};

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private currentLocaleSubject = new BehaviorSubject<SupportedLocale>('en-GB');
  public currentLocale$: Observable<SupportedLocale> = this.currentLocaleSubject.asObservable();

  constructor() {
    // Load saved locale from localStorage or default to en-GB
    const savedLocale = localStorage.getItem('app_locale') as SupportedLocale;
    if (savedLocale && translations[savedLocale]) {
      this.currentLocaleSubject.next(savedLocale);
    }
  }

  setLocale(locale: SupportedLocale): void {
    if (translations[locale]) {
      this.currentLocaleSubject.next(locale);
      localStorage.setItem('app_locale', locale);
    }
  }

  getCurrentLocale(): SupportedLocale {
    return this.currentLocaleSubject.value;
  }

  translate(key: keyof TranslationKeys): string {
    const locale = this.currentLocaleSubject.value;
    return translations[locale]?.[key] || key;
  }

  getTranslation(key: keyof TranslationKeys): string {
    return this.translate(key);
  }
}

