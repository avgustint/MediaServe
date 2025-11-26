import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type SupportedLocale = 'sl-SI' | 'en-GB' | 'it-IT';

export interface TranslationKeys {
  // Login
  login: string;
  loggingIn: string;
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
  bold: string;
  italic: string;
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
  fieldRequired: string;
  minLength: string;
  
  // Errors
  error: string;
  errorOccurred: string;
  pleaseTryAgain: string;
  
  // Additional UI Elements
  waitingForContent: string;
  noLibraryItemFoundWithId: string;
  pleaseEnterItemNumber: string;
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
  author: string;
  enterAuthor: string;
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
    
    // General Settings
    generalSettings: string;
    defaultBackgroundColor: string;
    defaultFontColor: string;
    defaultBlankPage: string;
    defaultBlankPageHelp: string;
    backgroundColor: string;
    fontColor: string;
    backgroundColorHelp: string;
    fontColorHelp: string;
    noPermissionToViewSettings: string;
    loading: string;
    saving: string;
    none: string;
    
    // Tags
    tags: string;
    tag: string;
    manageTags: string;
    addNewTag: string;
    editTag: string;
    tagName: string;
    tagDescription: string;
    enterTagName: string;
    enterTagDescription: string;
    tagSaved: string;
    errorSavingTag: string;
    deleteTag: string;
    deleteTagConfirm: string;
    tagUsedByItems: string;
    errorDeletingTag: string;
    noTagsFound: string;
    noTagsAvailable: string;
    searchTagsPlaceholder: string;
    
    // Collections
    collections: string;
    collection: string;
    manageCollections: string;
    addNewCollection: string;
    editCollection: string;
    collectionTitle: string;
    collectionLabel: string;
    collectionYear: string;
    collectionPublisher: string;
    collectionSource: string;
    enterCollectionTitle: string;
    enterCollectionLabel: string;
    enterCollectionYear: string;
    enterCollectionPublisher: string;
    enterCollectionSource: string;
    collectionSaved: string;
    errorSavingCollection: string;
    deleteCollection: string;
    deleteCollectionConfirm: string;
    errorDeletingCollection: string;
    noCollectionsFound: string;
    searchCollectionsPlaceholder: string;
    collectionItems: string;
    collectionNumber: string;
    collectionPage: string;
    addItemToCollection: string;
    removeItemFromCollection: string;
    enterCollectionNumber: string;
    enterCollectionPage: string;
    
    // Locations
    locations: string;
    location: string;
    manageLocations: string;
    addNewLocation: string;
    editLocation: string;
    locationName: string;
    locationDescription: string;
    enterLocationName: string;
    enterLocationDescription: string;
    locationSaved: string;
    errorSavingLocation: string;
    deleteLocation: string;
    deleteLocationConfirm: string;
    errorDeletingLocation: string;
    noLocationsFound: string;
    noLocation: string;
    searchLocationsPlaceholder: string;
    locationDeleted: string;
    selectLocation: string;
    errorLoadingLocations: string;
    
    // Pages
    managePages: string;
    pageContent: string;
    enterPageContent: string;
    pageSaved: string;
    errorSavingPage: string;
    deletePage: string;
    deletePageConfirm: string;
    errorDeletingPage: string;
    noPagesFound: string;
    searchPagesPlaceholder: string;
    reusePage: string;
    createNewPage: string;
    selectPage: string;
    orderNumber: string;
    allCollections: string;
    allTags: string;
  selectType: string;
  selectTags: string;
  tagsSelected: string;
    clearAllFilters: string;
    clearFilter: string;
}

const translations: Record<SupportedLocale, TranslationKeys> = {
  'en-GB': {
    // Login
    login: 'Login',
    loggingIn: 'Logging in',
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
    bold: 'Bold',
    italic: 'Italic',
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
    fieldRequired: 'This field is required',
    minLength: 'Minimum length is 3 characters',
    
    // Errors
    error: 'Error',
    errorOccurred: 'An error occurred',
    pleaseTryAgain: 'Please try again.',
    
    // Additional UI Elements
    waitingForContent: 'Waiting for content from WebSocket...',
    noLibraryItemFoundWithId: 'No library item found with ID:',
    pleaseEnterItemNumber: 'Please enter item number',
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
    author: 'Author',
    enterAuthor: 'Enter author (optional)',
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
    noLocale: 'No locale',
    
    // General Settings
    generalSettings: 'General Settings',
    defaultBackgroundColor: 'Default Background Color',
    defaultFontColor: 'Default Font Color',
    defaultBlankPage: 'Default Blank Page',
    defaultBlankPageHelp: 'Select a library item to display when no content is selected. Leave empty for no default.',
    backgroundColor: 'Background Color',
    fontColor: 'Font Color',
    backgroundColorHelp: 'Background color for this item. Leave empty to use default.',
    fontColorHelp: 'Font color for this item. Leave empty to use default.',
    noPermissionToViewSettings: 'You do not have permission to view settings.',
    loading: 'Loading',
    saving: 'Saving',
    none: 'None',
    
    // Tags
    tags: 'Tags',
    tag: 'Tag',
    manageTags: 'Manage Tags',
    addNewTag: 'Add New Tag',
    editTag: 'Edit Tag',
    tagName: 'Tag Name',
    tagDescription: 'Tag Description',
    enterTagName: 'Enter tag name',
    enterTagDescription: 'Enter tag description (optional)',
    tagSaved: 'Tag saved successfully',
    errorSavingTag: 'Error saving tag. Please try again.',
    deleteTag: 'Delete Tag',
    deleteTagConfirm: 'Are you sure you want to delete tag',
    tagUsedByItems: 'Tag is used by one or more library items and cannot be deleted.',
    errorDeletingTag: 'Error deleting tag. Please try again.',
    noTagsFound: 'No tags found',
    noTagsAvailable: 'No tags available',
    searchTagsPlaceholder: 'Search tags...',
    
    // Collections
    collections: 'Collections',
    collection: 'Collection',
    manageCollections: 'Manage Collections',
    addNewCollection: 'Add New Collection',
    editCollection: 'Edit Collection',
    collectionTitle: 'Collection Title',
    collectionLabel: 'Collection Label',
    collectionYear: 'Year',
    collectionPublisher: 'Publisher',
    collectionSource: 'Source',
    enterCollectionTitle: 'Enter collection title',
    enterCollectionLabel: 'Enter collection label (optional)',
    enterCollectionYear: 'Enter year (optional)',
    enterCollectionPublisher: 'Enter publisher (optional)',
    enterCollectionSource: 'Enter source (optional)',
    collectionSaved: 'Collection saved successfully',
    errorSavingCollection: 'Error saving collection. Please try again.',
    deleteCollection: 'Delete Collection',
    deleteCollectionConfirm: 'Are you sure you want to delete collection',
    errorDeletingCollection: 'Error deleting collection. Please try again.',
    noCollectionsFound: 'No collections found',
    searchCollectionsPlaceholder: 'Search collections...',
    collectionItems: 'Collection Items',
    collectionNumber: 'Collection Number',
    collectionPage: 'Collection Page',
    addItemToCollection: 'Add Item to Collection',
    removeItemFromCollection: 'Remove Item from Collection',
    enterCollectionNumber: 'Enter collection number (optional)',
    enterCollectionPage: 'Enter collection page (optional)',
    
    // Locations
    locations: 'Locations',
    location: 'Location',
    manageLocations: 'Manage Locations',
    addNewLocation: 'Add New Location',
    editLocation: 'Edit Location',
    locationName: 'Location Name',
    locationDescription: 'Location Description',
    enterLocationName: 'Enter location name',
    enterLocationDescription: 'Enter location description (optional)',
    locationSaved: 'Location saved successfully',
    errorSavingLocation: 'Error saving location. Please try again.',
    deleteLocation: 'Delete Location',
    deleteLocationConfirm: 'Are you sure you want to delete location',
    errorDeletingLocation: 'Error deleting location. Please try again.',
    noLocationsFound: 'No locations found',
    noLocation: 'No location',
    searchLocationsPlaceholder: 'Search locations...',
    locationDeleted: 'Location deleted successfully',
    selectLocation: 'Select location',
    errorLoadingLocations: 'Error loading locations. Please try again.',
    
    // Pages
    managePages: 'Manage Pages',
    pageContent: 'Page Content',
    enterPageContent: 'Enter page content',
    pageSaved: 'Page saved successfully',
    errorSavingPage: 'Error saving page. Please try again.',
    deletePage: 'Delete Page',
    deletePageConfirm: 'Are you sure you want to delete page',
    errorDeletingPage: 'Error deleting page. Please try again.',
    noPagesFound: 'No pages found',
    searchPagesPlaceholder: 'Search pages...',
    reusePage: 'Reuse Existing Page',
    createNewPage: 'Create New Page',
    selectPage: 'Select Page',
    orderNumber: 'Order Number',
    allCollections: 'All Collections',
    allTags: 'All Tags',
    selectType: 'Select a type',
    selectTags: 'Select tags',
    tagsSelected: 'tags selected',
    clearAllFilters: 'Clear All Filters',
    clearFilter: 'Clear Filter'
  },
  'sl-SI': {
    // Login
    login: 'Prijava',
    loggingIn: 'Prijavljanje',
    username: 'Uporabniško ime',
    password: 'Geslo',
    invalidCredentials: 'Napačno uporabniško ime ali geslo',
    loginFailed: 'Prijava ni uspela. Poskusite znova.',
    
    // App Navigation
    mediaPlayerAdmin: 'Upravljalec medijskega predvajalnika',
    playlist: 'Seznam predvajanja',
    editor: 'Urejevalnik',
    settings: 'Nastavitve',
    display: 'Zaslon',
    logout: 'Odjava',
    confirmLogout: 'Potrditev odjave',
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
    playlistEditor: 'Seznam predvajanja',
    searchLibraryItems: 'Iskanje knjižničnih postavk...',
    searchPlaylists: 'Iskanje seznamov predvajanja...',
    addNewLibraryItem: 'Dodaj novo knjižnično postavko',
    addNewPlaylist: 'Dodaj nov seznam predvajanja',
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
    addPage: 'Dodaj stran',
    removePage: 'Odstrani stran',
    uploadImage: 'Naloži sliko',
    bold: 'Krepko',
    italic: 'Ležeče',
    noResults: 'Ni rezultatov',
    noLibraryItemsFound: 'Ni najdenih knjižničnih postavk',
    confirmDelete: 'Potrditev brisanja',
    confirmDeleteMessage: 'Ali ste prepričani, da želite izbrisati to postavko? To dejanje ni mogoče razveljaviti.',
    libraryItemDeleted: 'Knjižnična postavka je bila uspešno izbrisana',
    playlistDeleted: 'Seznam predvajanja je bil uspešno izbrisan',
    errorDeletingItem: 'Napaka pri brisanju postavke. Poskusite znova.',
    itemUsedInPlaylists: 'Postavka se uporablja v seznamih predvajanja',
    cannotDeleteItem: 'Te postavke ni mogoče izbrisati',
    rolePermissionsUpdated: 'Dovoljenja vlog so bila uspešno posodobljena!',
    
    // Settings
    users: 'Uporabniki',
    rolesPermissions: 'Vloge in dovoljenja',
    addNewUser: 'Dodaj novega uporabnika',
    editUser: 'Uredi uporabnika',
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
    fieldRequired: 'To polje je obvezno',
    minLength: 'Najmanjša dolžina je 3 znaki',
    
    // Errors
    error: 'Napaka',
    errorOccurred: 'Prišlo je do napake',
    pleaseTryAgain: 'Poskusite znova.',
    
    // Additional UI Elements
    waitingForContent: 'Čakanje na vsebino iz WebSocket...',
    noLibraryItemFoundWithId: 'Ni najdene knjižnične postavke z ID:',
    pleaseEnterItemNumber: 'Prosimo vnesite številko postavke',
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
    savePermissions: 'Shrani dovoljenja',
    selectRoleToEdit: 'Izberite vlogo za urejanje dovoljenj',
    permissionsFor: 'Dovoljenja za:',
    noRoleSelected: 'Izberite vlogo za urejanje dovoljenj',
    enterItemName: 'Vnesite ime postavke',
    enterItemDescription: 'Vnesite opis postavke (neobvezno)',
    author: 'Avtor',
    enterAuthor: 'Vnesite avtorja (neobvezno)',
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
    selectAll: 'Izberi vse',
    clearAllPages: 'Počisti (vse strani)',
    noItemsInPlaylist: 'Ni postavk v seznamu predvajanja. Dodajte knjižnične postavke zgoraj.',
    moveUp: 'Premakni navzgor',
    moveDown: 'Premakni navzdol',
    remove: 'Odstrani',
    deleteUser: 'Izbriši uporabnika',
    deletePlaylist: 'Izbriši seznam predvajanja',
    deleteItem: 'Izbriši postavko',
    recentlyModified: 'Nedavno spremenjeno (zadnjih 50)',
    modified: 'Spremenjeno:',
    selectPlaylist: 'Izberite seznam predvajanja',
    noPlaylistsFound: 'Ni najdenih seznamov predvajanja',
    libraryItems: 'Knjižnične postavke',
    nameAndEmailAndUsernameRequired: 'Ime, E-pošta in Uporabniško ime so obvezni.',
    pleaseSelectValidLibraryItem: 'Prosimo, izberite veljavno knjižnično postavko',
    pleaseEnterNameForPlaylist: 'Prosimo, vnesite ime za seznam predvajanja',
    itemUsedInPlaylistsDetail: 'Postavka se uporablja v naslednjih seznamih predvajanja:',
    loadingPlaylist: 'Nalaganje seznama predvajanja...',
    editLibraryItem: 'Uredi knjižnično postavko',
    editPlaylist: 'Uredi seznam predvajanja',
    updated: 'Posodobljeno',
    selected: 'Izbrano',
    descriptionOptional: 'Opis (neobvezno)',
    ok: 'V redu',
    contentPages: 'Vsebinske strani',
    imageFile: 'Slikovna datoteka',
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
    isAdminRole: 'Je administratorska vloga',
    adminRoleNameOnlyEditable: 'Za administratorske vloge je mogoče urejati samo ime.',
    adminRole: 'Administratorska vloga',
    noRolesFound: 'Ni najdenih vlog',
    
    // User Profile
    userProfile: 'Uporabniški profil',
    editProfile: 'Uredi profil',
    changePassword: 'Spremeni geslo',
    currentPassword: 'Trenutno geslo',
    newPassword: 'Novo geslo',
    confirmPassword: 'Potrdi geslo',
    usernameCannotBeChanged: 'Uporabniškega imena ni mogoče spremeniti',
    passwordsDoNotMatch: 'Gesli se ne ujemata',
    passwordTooShort: 'Geslo mora biti dolgo vsaj 6 znakov',
    invalidCurrentPassword: 'Napačno trenutno geslo',
    errorChangingPassword: 'Napaka pri spreminjanju gesla. Prosimo, poskusite znova.',
    enterCurrentPassword: 'Vnesite trenutno geslo',
    enterNewPassword: 'Vnesite novo geslo',
    enterConfirmPassword: 'Potrdite novo geslo',
    noLocale: 'Brez jezika',
    
    // General Settings
    generalSettings: 'Splošne nastavitve',
    defaultBackgroundColor: 'Privzeta barva ozadja',
    defaultFontColor: 'Privzeta barva pisave',
    defaultBlankPage: 'Privzeta prazna stran',
    defaultBlankPageHelp: 'Izberite knjižnično postavko za prikaz, ko ni izbrane vsebine. Pustite prazno za brez privzete.',
    backgroundColor: 'Barva ozadja',
    fontColor: 'Barva pisave',
    backgroundColorHelp: 'Barva ozadja za to postavko. Pustite prazno za uporabo privzete.',
    fontColorHelp: 'Barva pisave za to postavko. Pustite prazno za uporabo privzete.',
    noPermissionToViewSettings: 'Nimate dovoljenja za ogled nastavitev.',
    loading: 'Nalaganje',
    saving: 'Shranjevanje',
    none: 'Brez',
    
    // Tags
    tags: 'Oznake',
    tag: 'Oznaka',
    manageTags: 'Upravljanje oznak',
    addNewTag: 'Dodaj novo oznako',
    editTag: 'Uredi oznako',
    tagName: 'Ime oznake',
    tagDescription: 'Opis oznake',
    enterTagName: 'Vnesite ime oznake',
    enterTagDescription: 'Vnesite opis oznake (neobvezno)',
    tagSaved: 'Oznaka je bila uspešno shranjena',
    errorSavingTag: 'Napaka pri shranjevanju oznake. Poskusite znova.',
    deleteTag: 'Izbriši oznako',
    deleteTagConfirm: 'Ali ste prepričani, da želite izbrisati oznako',
    tagUsedByItems: 'Oznaka se uporablja pri eni ali več knjižničnih postavkah in je ni mogoče izbrisati.',
    errorDeletingTag: 'Napaka pri brisanju oznake. Poskusite znova.',
    noTagsFound: 'Ni najdenih oznak',
    noTagsAvailable: 'Ni na voljo oznak',
    searchTagsPlaceholder: 'Iskanje oznak...',
    
    // Collections
    collections: 'Zbirke',
    collection: 'Zbirka',
    manageCollections: 'Upravljanje zbirk',
    addNewCollection: 'Dodaj novo zbirko',
    editCollection: 'Uredi zbirko',
    collectionTitle: 'Naslov zbirke',
    collectionLabel: 'Oznaka zbirke',
    collectionYear: 'Leto',
    collectionPublisher: 'Založnik',
    collectionSource: 'Vir',
    enterCollectionTitle: 'Vnesite naslov zbirke',
    enterCollectionLabel: 'Vnesite oznako zbirke (neobvezno)',
    enterCollectionYear: 'Vnesite leto (neobvezno)',
    enterCollectionPublisher: 'Vnesite založnika (neobvezno)',
    enterCollectionSource: 'Vnesite vir (neobvezno)',
    collectionSaved: 'Zbirka je bila uspešno shranjena',
    errorSavingCollection: 'Napaka pri shranjevanju zbirke. Poskusite znova.',
    deleteCollection: 'Izbriši zbirko',
    deleteCollectionConfirm: 'Ali ste prepričani, da želite izbrisati zbirko',
    errorDeletingCollection: 'Napaka pri brisanju zbirke. Poskusite znova.',
    noCollectionsFound: 'Ni najdenih zbirk',
    searchCollectionsPlaceholder: 'Iskanje zbirk...',
    collectionItems: 'Postavke zbirke',
    collectionNumber: 'Številka v zbirki',
    collectionPage: 'Stran v zbirki',
    addItemToCollection: 'Dodaj postavko v zbirko',
    removeItemFromCollection: 'Odstrani postavko iz zbirke',
    enterCollectionNumber: 'Vnesite številko v zbirki (neobvezno)',
    enterCollectionPage: 'Vnesite stran v zbirki (neobvezno)',
    
    // Locations
    locations: 'Lokacije',
    location: 'Lokacija',
    manageLocations: 'Upravljanje lokacij',
    addNewLocation: 'Dodaj novo lokacijo',
    editLocation: 'Uredi lokacijo',
    locationName: 'Ime lokacije',
    locationDescription: 'Opis lokacije',
    enterLocationName: 'Vnesite ime lokacije',
    enterLocationDescription: 'Vnesite opis lokacije (neobvezno)',
    locationSaved: 'Lokacija uspešno shranjena',
    errorSavingLocation: 'Napaka pri shranjevanju lokacije. Poskusite znova.',
    deleteLocation: 'Izbriši lokacijo',
    deleteLocationConfirm: 'Ali ste prepričani, da želite izbrisati lokacijo',
    errorDeletingLocation: 'Napaka pri brisanju lokacije. Poskusite znova.',
    noLocationsFound: 'Ni najdenih lokacij',
    noLocation: 'Ni lokacije',
    searchLocationsPlaceholder: 'Iskanje lokacij...',
    locationDeleted: 'Lokacija uspešno izbrisana',
    selectLocation: 'Izberite lokacijo',
    errorLoadingLocations: 'Napaka pri nalaganju lokacij. Poskusite znova.',
    
    // Pages
    managePages: 'Upravljanje strani',
    pageContent: 'Vsebina strani',
    enterPageContent: 'Vnesite vsebino strani',
    pageSaved: 'Stran je bila uspešno shranjena',
    errorSavingPage: 'Napaka pri shranjevanju strani. Poskusite znova.',
    deletePage: 'Izbriši stran',
    deletePageConfirm: 'Ali ste prepričani, da želite izbrisati stran',
    errorDeletingPage: 'Napaka pri brisanju strani. Poskusite znova.',
    noPagesFound: 'Ni najdenih strani',
    searchPagesPlaceholder: 'Iskanje strani...',
    reusePage: 'Ponovno uporabi obstoječo stran',
    createNewPage: 'Ustvari novo stran',
    selectPage: 'Izberi stran',
    orderNumber: 'Vrstni red',
    allCollections: 'Vse zbirke',
    allTags: 'Vse oznake',
    selectType: 'Izberite vrsto',
    selectTags: 'Izberite oznake',
    tagsSelected: 'izbranih oznak',
    clearAllFilters: 'Počisti vse filtre',
    clearFilter: 'Počisti filter'
  },
  'it-IT': {
    // Login
    login: 'Accesso',
    loggingIn: 'Accesso in corso',
    username: 'Nome utente',
    password: 'Password',
    invalidCredentials: 'Nome utente o password non validi',
    loginFailed: 'Accesso fallito. Riprova.',
    
    // App Navigation
    mediaPlayerAdmin: 'Amministrazione media player',
    playlist: 'Playlist',
    editor: 'Editor',
    settings: 'Impostazioni',
    display: 'Visualizzazione',
    logout: 'Esci',
    confirmLogout: 'Conferma uscita',
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
    addNewLibraryItem: 'Aggiungi nuovo elemento biblioteca',
    addNewPlaylist: 'Aggiungi nuova playlist',
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
    addPage: 'Aggiungi pagina',
    removePage: 'Rimuovi pagina',
    uploadImage: 'Carica immagine',
    bold: 'Grassetto',
    italic: 'Corsivo',
    noResults: 'Nessun risultato',
    noLibraryItemsFound: 'Nessun elemento biblioteca trovato',
    confirmDelete: 'Conferma eliminazione',
    confirmDeleteMessage: 'Sei sicuro di voler eliminare questo elemento? Questa azione non può essere annullata.',
    libraryItemDeleted: 'Elemento biblioteca eliminato con successo',
    playlistDeleted: 'Playlist eliminata con successo',
    errorDeletingItem: 'Errore durante l\'eliminazione. Riprova.',
    itemUsedInPlaylists: 'Elemento utilizzato in playlist',
    cannotDeleteItem: 'Impossibile eliminare questo elemento',
    rolePermissionsUpdated: 'Permessi ruolo aggiornati con successo!',
    
    // Settings
    users: 'Utenti',
    rolesPermissions: 'Ruoli e permessi',
    addNewUser: 'Aggiungi nuovo utente',
    editUser: 'Modifica utente',
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
    fieldRequired: 'Questo campo è obbligatorio',
    minLength: 'La lunghezza minima è di 3 caratteri',
    
    // Errors
    error: 'Errore',
    errorOccurred: 'Si è verificato un errore',
    pleaseTryAgain: 'Riprova.',
    
    // Additional UI Elements
    waitingForContent: 'In attesa di contenuto da WebSocket...',
    noLibraryItemFoundWithId: 'Nessun elemento biblioteca trovato con ID:',
    pleaseEnterItemNumber: 'Inserisci il numero dell\'elemento',
    clearId: 'Cancella ID',
    deleteLastDigit: 'Elimina ultima cifra',
    enter: 'Invio',
    goToPage: 'Vai alla pagina',
    toggleSidebar: 'Attiva/disattiva barra laterale',
    closeSidebar: 'Chiudi barra laterale',
    typeColon: 'Tipo:',
    permission: 'Permesso',
    permissions: 'Permessi',
    readOnly: 'Sola lettura',
    savePermissions: 'Salva permessi',
    selectRoleToEdit: 'Seleziona un ruolo per modificare i permessi',
    permissionsFor: 'Permessi per:',
    noRoleSelected: 'Seleziona un ruolo per modificare i permessi',
    enterItemName: 'Inserisci nome elemento',
    enterItemDescription: 'Inserisci descrizione elemento (opzionale)',
    author: 'Autore',
    enterAuthor: 'Inserisci autore (opzionale)',
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
    selectAll: 'Seleziona tutto',
    clearAllPages: 'Cancella (tutte le pagine)',
    noItemsInPlaylist: 'Nessun elemento nella playlist. Aggiungi elementi biblioteca sopra.',
    moveUp: 'Sposta su',
    moveDown: 'Sposta giù',
    remove: 'Rimuovi',
    deleteUser: 'Elimina utente',
    deletePlaylist: 'Elimina playlist',
    deleteItem: 'Elimina elemento',
    recentlyModified: 'Modificati di recente (ultimi 50)',
    modified: 'Modificato:',
    selectPlaylist: 'Seleziona una playlist',
    noPlaylistsFound: 'Nessuna playlist trovata',
    libraryItems: 'Elementi biblioteca',
    nameAndEmailAndUsernameRequired: 'Nome, Email e Nome utente sono obbligatori.',
    pleaseSelectValidLibraryItem: 'Seleziona un elemento biblioteca valido',
    pleaseEnterNameForPlaylist: 'Inserisci un nome per la playlist',
    itemUsedInPlaylistsDetail: 'Elemento utilizzato nelle seguenti playlist:',
    loadingPlaylist: 'Caricamento playlist...',
    editLibraryItem: 'Modifica elemento biblioteca',
    contentPages: 'Pagine contenuto',
    imageFile: 'File immagine',
    preview: 'Anteprima',
    item: 'Elemento',
    editPlaylist: 'Modifica playlist',
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
    addNewRole: 'Aggiungi nuovo ruolo',
    editRole: 'Modifica ruolo',
    roleSaved: 'Ruolo salvato con successo',
    errorSavingRole: 'Errore nel salvare il ruolo. Riprova.',
    deleteRole: 'Elimina ruolo',
    deleteRoleConfirm: 'Sei sicuro di voler eliminare il ruolo',
    cannotDeleteAdminRole: 'Non è possibile eliminare il ruolo amministratore.',
    roleUsedByUsers: 'Il ruolo è utilizzato da uno o più utenti e non può essere eliminato.',
    errorDeletingRole: 'Errore nell\'eliminazione del ruolo. Riprova.',
    enterRoleName: 'Inserisci nome ruolo',
    isAdminRole: 'È ruolo amministratore',
    adminRoleNameOnlyEditable: 'Per i ruoli amministratore, è possibile modificare solo il nome.',
    adminRole: 'Ruolo amministratore',
    noRolesFound: 'Nessun ruolo trovato',
    
    // User Profile
    userProfile: 'Profilo utente',
    editProfile: 'Modifica profilo',
    changePassword: 'Cambia password',
    currentPassword: 'Password attuale',
    newPassword: 'Nuova password',
    confirmPassword: 'Conferma password',
    usernameCannotBeChanged: 'Il nome utente non può essere modificato',
    passwordsDoNotMatch: 'Le password non corrispondono',
    passwordTooShort: 'La password deve essere lunga almeno 6 caratteri',
    invalidCurrentPassword: 'Password attuale non valida',
    errorChangingPassword: 'Errore durante la modifica della password. Riprova.',
    enterCurrentPassword: 'Inserisci password attuale',
    enterNewPassword: 'Inserisci nuova password',
    enterConfirmPassword: 'Conferma nuova password',
    noLocale: 'Nessuna lingua',
    
    // General Settings
    generalSettings: 'Impostazioni generali',
    defaultBackgroundColor: 'Colore di sfondo predefinito',
    defaultFontColor: 'Colore del carattere predefinito',
    defaultBlankPage: 'Pagina vuota predefinita',
    defaultBlankPageHelp: 'Seleziona un elemento della libreria da visualizzare quando non è selezionato alcun contenuto. Lascia vuoto per nessun default.',
    backgroundColor: 'Colore di sfondo',
    fontColor: 'Colore del carattere',
    backgroundColorHelp: 'Colore di sfondo per questo elemento. Lascia vuoto per usare il default.',
    fontColorHelp: 'Colore del carattere per questo elemento. Lascia vuoto per usare il default.',
    noPermissionToViewSettings: 'Non hai il permesso di visualizzare le impostazioni.',
    loading: 'Caricamento',
    saving: 'Salvataggio',
    none: 'Nessuno',
    
    // Tags
    tags: 'Tag',
    tag: 'Tag',
    manageTags: 'Gestisci Tag',
    addNewTag: 'Aggiungi Nuovo Tag',
    editTag: 'Modifica Tag',
    tagName: 'Nome Tag',
    tagDescription: 'Descrizione Tag',
    enterTagName: 'Inserisci nome tag',
    enterTagDescription: 'Inserisci descrizione tag (opzionale)',
    tagSaved: 'Tag salvato con successo',
    errorSavingTag: 'Errore nel salvare il tag. Riprova.',
    deleteTag: 'Elimina Tag',
    deleteTagConfirm: 'Sei sicuro di voler eliminare il tag',
    tagUsedByItems: 'Il tag è utilizzato da uno o più elementi della biblioteca e non può essere eliminato.',
    errorDeletingTag: 'Errore nell\'eliminazione del tag. Riprova.',
    noTagsFound: 'Nessun tag trovato',
    noTagsAvailable: 'Nessun tag disponibile',
    searchTagsPlaceholder: 'Cerca tag...',
    
    // Collections
    collections: 'Collezioni',
    collection: 'Collezione',
    manageCollections: 'Gestisci Collezioni',
    addNewCollection: 'Aggiungi Nuova Collezione',
    editCollection: 'Modifica Collezione',
    collectionTitle: 'Titolo Collezione',
    collectionLabel: 'Etichetta Collezione',
    collectionYear: 'Anno',
    collectionPublisher: 'Editore',
    collectionSource: 'Fonte',
    enterCollectionTitle: 'Inserisci titolo collezione',
    enterCollectionLabel: 'Inserisci etichetta collezione (opzionale)',
    enterCollectionYear: 'Inserisci anno (opzionale)',
    enterCollectionPublisher: 'Inserisci editore (opzionale)',
    enterCollectionSource: 'Inserisci fonte (opzionale)',
    collectionSaved: 'Collezione salvata con successo',
    errorSavingCollection: 'Errore nel salvare la collezione. Riprova.',
    deleteCollection: 'Elimina Collezione',
    deleteCollectionConfirm: 'Sei sicuro di voler eliminare la collezione',
    errorDeletingCollection: 'Errore nell\'eliminazione della collezione. Riprova.',
    noCollectionsFound: 'Nessuna collezione trovata',
    searchCollectionsPlaceholder: 'Cerca collezioni...',
    collectionItems: 'Elementi Collezione',
    collectionNumber: 'Numero Collezione',
    collectionPage: 'Pagina Collezione',
    addItemToCollection: 'Aggiungi Elemento alla Collezione',
    removeItemFromCollection: 'Rimuovi Elemento dalla Collezione',
    enterCollectionNumber: 'Inserisci numero collezione (opzionale)',
    enterCollectionPage: 'Inserisci pagina collezione (opzionale)',
    
    // Locations
    locations: 'Posizioni',
    location: 'Posizione',
    manageLocations: 'Gestisci Posizioni',
    addNewLocation: 'Aggiungi Nuova Posizione',
    editLocation: 'Modifica Posizione',
    locationName: 'Nome Posizione',
    locationDescription: 'Descrizione Posizione',
    enterLocationName: 'Inserisci nome posizione',
    enterLocationDescription: 'Inserisci descrizione posizione (opzionale)',
    locationSaved: 'Posizione salvata con successo',
    errorSavingLocation: 'Errore nel salvare la posizione. Riprova.',
    deleteLocation: 'Elimina Posizione',
    deleteLocationConfirm: 'Sei sicuro di voler eliminare la posizione',
    errorDeletingLocation: 'Errore nell\'eliminare la posizione. Riprova.',
    noLocationsFound: 'Nessuna posizione trovata',
    noLocation: 'Nessuna posizione',
    searchLocationsPlaceholder: 'Cerca posizioni...',
    locationDeleted: 'Posizione eliminata con successo',
    selectLocation: 'Seleziona posizione',
    errorLoadingLocations: 'Errore nel caricamento delle posizioni. Riprova.',
    
    // Pages
    managePages: 'Gestisci Pagine',
    pageContent: 'Contenuto Pagina',
    enterPageContent: 'Inserisci contenuto pagina',
    pageSaved: 'Pagina salvata con successo',
    errorSavingPage: 'Errore nel salvare la pagina. Riprova.',
    deletePage: 'Elimina Pagina',
    deletePageConfirm: 'Sei sicuro di voler eliminare la pagina',
    errorDeletingPage: 'Errore nell\'eliminazione della pagina. Riprova.',
    noPagesFound: 'Nessuna pagina trovata',
    searchPagesPlaceholder: 'Cerca pagine...',
    reusePage: 'Riutilizza Pagina Esistente',
    createNewPage: 'Crea Nuova Pagina',
    selectPage: 'Seleziona Pagina',
    orderNumber: 'Numero Ordine',
    allCollections: 'Tutte le Collezioni',
    allTags: 'Tutti i Tag',
    selectType: 'Seleziona un tipo',
    selectTags: 'Seleziona tag',
    tagsSelected: 'tag selezionati',
    clearAllFilters: 'Cancella Tutti i Filtri',
    clearFilter: 'Cancella Filtro'
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

