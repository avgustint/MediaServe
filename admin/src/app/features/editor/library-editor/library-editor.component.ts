import { Component, OnInit, ViewChild, ElementRef, QueryList, ViewChildren, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { PlaylistService, LibraryItem, LibraryContent } from "../../playlist/services/playlist.service";
import { PagesService, Page } from "../services/pages.service";
import { TagsService, Tag } from "../services/tags.service";
import { UserService } from "../../../core/services/user.service";
import { ErrorPopupComponent } from "../../../shared/feedback/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../../../shared/feedback/confirm-dialog/confirm-dialog.component";
import { TranslatePipe } from "../../../shared/pipes/translation.pipe";
import { LocalizedDatePipe } from "../../../shared/pipes/localized-date.pipe";
import { TranslationService } from "../../../core/services/translation.service";
import { environment } from "../../../../environments/environment";
import { debounceTime, distinctUntilChanged, Subject, switchMap, of, forkJoin } from "rxjs";
import { InputTextModule } from "primeng/inputtext";
import { TextareaModule } from "primeng/textarea";
import { SelectModule } from "primeng/select";
import { MultiSelectModule } from "primeng/multiselect";
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { TabsModule } from "primeng/tabs";
import { ToggleSwitchModule } from "primeng/toggleswitch";

@Component({
  selector: "app-library-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent, ConfirmDialogComponent, TranslatePipe, LocalizedDatePipe, InputTextModule, TextareaModule, SelectModule, MultiSelectModule, ButtonModule, DialogModule, TabsModule, ToggleSwitchModule],
  templateUrl: "./library-editor.component.html",
  styleUrls: ["./library-editor.component.scss"]
})
export class LibraryEditorComponent implements OnInit, AfterViewInit {
  @ViewChildren('contentEditable') contentEditables!: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChild('pageContentEditable') pageContentEditable!: ElementRef<HTMLDivElement>;
  
  searchTerm: string = "";
  searchResults: LibraryItem[] = [];
  showSearchResults: boolean = false;
  private searchSubject = new Subject<string>();

  // Recently modified items
  recentItems: LibraryItem[] = [];
  showRecentItems: boolean = true;

  editingItem: LibraryItem | null = null;
  isNewItem: boolean = false;

  // Form fields
  itemName: string = "";
  itemDescription: string = "";
  itemAuthor: string = "";
  itemDuration: number | null = null; // Autoplay duration in seconds (null = no autoplay)

  // Page Manage Dialog - type and type-specific fields
  pageDialogType: "text" | "image" | "url" | "video" | "iframe" = "text";
  pageDialogImagePreview: string | null = null;

  get pageDialogVideoPreviewUrl(): string | null {
    if (!this.pageDialogVideoUrl) return null;
    const url = this.pageDialogVideoUrl;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${environment.apiUrl}${url.startsWith('/') ? url : '/' + url}`;
  }
  pageDialogImageBase64: string | null = null;
  pageDialogUrl: string = "";
  pageDialogVideoUrl: string = "";
  pageDialogVideoUploading: boolean = false;
  pageDialogIframeContent: string = "";
  pageDialogCssProperties: string = "";
  pageDialogDuration: number | null = null; // Override autoplay duration for this page (null = use item default)
  pageDialogImageHeight100: boolean = true; // Default height 100% for image pages
  pageDialogImageWidth100: boolean = false;
  
  // Dropdown options for page type
  typeOptions: Array<{ label: string; value: "text" | "image" | "url" | "video" | "iframe" }> = [];
  
  // Text type fields - new page management system
  pageReferences: Array<{ pageGuid: number | string; orderNumber: number; page?: Page }> = [];
  allAvailablePages: Page[] = []; // Only pages from current library item
  allAvailableTags: Tag[] = [];
  selectedTagGuids: number[] = [];
  
  // For PrimeNG MultiSelect
  selectedTags: Tag[] = [];
  
  // Legacy support - for backward compatibility display
  textPages: LibraryContent[] = [];
  
  // Page management UI state
  showPageSelector: boolean = false;
  pageSelectorIndex: number = -1; // Index in pageReferences where to insert
  showPageDialog: boolean = false;
  showPageManageDialog: boolean = false; // New dialog with tabs
  newPageContent: string = '';
  editingPageIndex: number = -1; // Index of page being edited, -1 for new page
  activeTabIndex: number = 0; // 0 = Create new, 1 = Reuse existing
  pageDialogContent: string = ''; // Content for page dialog
  selectedReusablePageGuid: number | string | null = null; // GUID of selected page in reuse tab
  nextTemporalId: number = -1; // Start from -1 for temporal page IDs
  


  // Color fields
  backgroundColor: string = "";
  fontColor: string = "";
  
  // CSS custom properties field (stored as JSON string in form, parsed to object)
  cssProperties: string = ""; // JSON string for editing

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  // Confirm dialog
  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = "";
  confirmDialogMessage: string = "";
  itemToDeleteGuid: number | null = null;
  
  // Confirm dialog for page removal
  showConfirmPageRemoveDialog: boolean = false;
  pageToRemoveIndex: number = -1;
  pageToRemoveGuid: number | string | null = null; // Store the pageGuid to identify the correct page
  pageToRemoveOrderNumber: number = -1; // Store the orderNumber which is unique for each page reference

  constructor(
    private playlistService: PlaylistService,
    private pagesService: PagesService,
    private tagsService: TagsService,
    private userService: UserService,
    private translationService: TranslationService,
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  hasManageLibraryPermission(): boolean {
    return this.userService.hasPermission('ManageLibrary');
  }

  hasViewLibraryPermission(): boolean {
    return this.userService.hasPermission('ViewLibrary') || this.userService.hasPermission('ViewLibraryEditor');
  }

  ngOnInit(): void {
    // Initialize type options
    this.typeOptions = [
      { label: this.translationService.translate('text'), value: 'text' },
      { label: this.translationService.translate('image'), value: 'image' },
      { label: this.translationService.translate('url'), value: 'url' },
      { label: this.translationService.translate('video') || 'Video', value: 'video' },
      { label: this.translationService.translate('iframe') || 'iFrame', value: 'iframe' }
    ];
    
    // Load recently modified items
    this.loadRecentItems();
    
    // Load available pages and tags
    this.loadAvailablePages();
    this.loadAvailableTags();

    // Setup search with debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        if (searchTerm.trim().length === 0) {
          this.searchResults = [];
          this.showSearchResults = false;
          this.showRecentItems = true;
          return of([]);
        }
        this.showRecentItems = false;
        return this.playlistService.searchLibraryItems(searchTerm);
      })
    ).subscribe({
      next: (results) => {
        this.searchResults = results;
        this.showSearchResults = results.length > 0 || this.searchTerm.trim().length > 0;
      },
      error: (error) => {
        console.error("Error searching library items:", error);
        this.searchResults = [];
        this.showSearchResults = false;
      }
    });
  }
  
  loadAvailablePages(): void {
    // Don't load all pages - only pages from current item will be shown
    // Pages are loaded when editing an item via loadPagesForItem()
    this.allAvailablePages = [];
  }
  
  loadPagesForItem(itemGuid: number, contentPages: LibraryContent[]): void {
    // Load only pages that belong to this specific library item
    this.pagesService.getPagesForLibraryItem(itemGuid).subscribe({
      next: (itemPages) => {
        const refs: Array<{ pageGuid: number | string; orderNumber: number; page?: Page }> = [];
        
        // Backend returns pages ordered by order_number, so we can use array index as order
        // Build page references directly from loaded pages (which are already in correct order)
        itemPages.forEach((page, index) => {
          refs.push({
            pageGuid: page.guid,
            orderNumber: index + 1, // Pages from backend are already ordered correctly
            page: page
          });
        });
        
        // Set pages that belong to this item (including temporal pages already added)
        const temporalPages = this.allAvailablePages.filter(p => p.isTemporal);
        this.allAvailablePages = [...itemPages, ...temporalPages];
        this.pageReferences = refs;
        
        // Update textPages from loaded pages to ensure all pages are available
        // This ensures the UI shows all pages, not just the first one
        if (itemPages.length > 0) {
          this.textPages = itemPages.map((page, index) => ({
            page: index + 1,
            content: page.content || ''
          }));
        } else if (contentPages && Array.isArray(contentPages) && contentPages.length > 0) {
          // Fallback to contentPages if no pages found in database
          this.textPages = [...contentPages];
        }
      },
      error: (error) => {
        console.error("Error loading pages for item:", error);
        // Keep temporal pages even if loading fails
        const temporalPages = this.allAvailablePages.filter(p => p.isTemporal);
        this.allAvailablePages = temporalPages;
        this.pageReferences = [];
        
        // Fallback to contentPages if loading fails
        if (contentPages && Array.isArray(contentPages) && contentPages.length > 0) {
          this.textPages = [...contentPages];
        }
      }
    });
  }
  
  updateAvailablePagesForNewItem(): void {
    // For new items, only show temporal pages (if any)
    // When editing an existing item, pages are loaded via loadPagesForItem
    if (this.isNewItem || !this.editingItem) {
      // Keep only temporal pages for new items
      this.allAvailablePages = this.allAvailablePages.filter(p => p.isTemporal);
    }
  }
  
  loadAvailableTags(): void {
    this.tagsService.getAllTags().subscribe({
      next: (tags) => {
        this.allAvailableTags = tags;
        // Sync selectedTags with selectedTagGuids after tags are loaded
        if (this.selectedTagGuids.length > 0) {
          this.selectedTags = tags.filter(tag => this.selectedTagGuids.includes(tag.guid));
        }
      },
      error: (error) => {
        console.error("Error loading tags:", error);
      }
    });
  }

  ngAfterViewInit(): void {
  }

  updateContentEditableDivs(): void {
    this.contentEditables.forEach((editable, index) => {
      if (this.textPages[index]) {
        editable.nativeElement.innerHTML = this.textPages[index].content || '';
      }
    });
  }

  getContentFromEditable(pageIndex: number): string {
    const editable = this.contentEditables.toArray()[pageIndex];
    if (editable) {
      return editable.nativeElement.innerHTML || '';
    }
    return this.textPages[pageIndex]?.content || '';
  }

  applyFormatting(pageIndex: number, command: 'bold' | 'italic' | 'chord' | 'chi'): void {
    const editable = this.contentEditables.toArray()[pageIndex];
    if (!editable) return;

    // Focus the contenteditable div
    editable.nativeElement.focus();
    
    // Save current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // If no selection, can't apply chord or chi (needs text selection)
      if (command === 'chord' || command === 'chi') {
        return;
      }
      // For bold/italic, apply to entire content
      document.execCommand(command, false, undefined);
      return;
    }

    // Handle chord formatting specially
    if (command === 'chord') {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      
      if (selectedText) {
        // Check if selection is already wrapped in a chord tag
        let container: Node | null = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) {
          container = container.parentElement;
        }
        
        // Check if we're inside a chord tag (closest only exists on Element)
        let chordElement: Element | null = null;
        if (container && container.nodeType === Node.ELEMENT_NODE) {
          chordElement = (container as Element).closest('chord');
        }
        
        if (chordElement) {
          // Remove chord tag - unwrap
          const parent = chordElement.parentElement;
          if (parent) {
            while (chordElement.firstChild) {
              parent.insertBefore(chordElement.firstChild, chordElement);
            }
            parent.removeChild(chordElement);
            // Normalize to merge adjacent text nodes
            parent.normalize();
          }
        } else {
          // Wrap selection in chord tag
          const chordTag = document.createElement('chord');
          try {
            range.surroundContents(chordTag);
          } catch (e) {
            // If surroundContents fails, use extractContents
            const contents = range.extractContents();
            chordTag.appendChild(contents);
            range.insertNode(chordTag);
          }
        }
        
        // Update the model
        if (this.textPages[pageIndex]) {
          this.textPages[pageIndex].content = editable.nativeElement.innerHTML;
        }
      }
    } else if (command === 'chi') {
      // Handle chi formatting specially (similar to chord)
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      
      if (selectedText) {
        // Check if selection is already wrapped in a chi tag
        let container: Node | null = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) {
          container = container.parentElement;
        }
        
        // Check if we're inside a chi tag (closest only exists on Element)
        let chiElement: Element | null = null;
        if (container && container.nodeType === Node.ELEMENT_NODE) {
          chiElement = (container as Element).closest('chi');
        }
        
        if (chiElement) {
          // Remove chi tag - unwrap
          const parent = chiElement.parentElement;
          if (parent) {
            while (chiElement.firstChild) {
              parent.insertBefore(chiElement.firstChild, chiElement);
            }
            parent.removeChild(chiElement);
            // Normalize to merge adjacent text nodes
            parent.normalize();
          }
        } else {
          // Wrap selection in chi tag
          const chiTag = document.createElement('chi');
          try {
            range.surroundContents(chiTag);
          } catch (e) {
            // If surroundContents fails, use extractContents
            const contents = range.extractContents();
            chiTag.appendChild(contents);
            range.insertNode(chiTag);
          }
        }
        
        // Update the model
        if (this.textPages[pageIndex]) {
          this.textPages[pageIndex].content = editable.nativeElement.innerHTML;
        }
      }
    } else {
      // Apply standard formatting (bold/italic)
      document.execCommand(command, false, undefined);
      
      // Update the model
      if (this.textPages[pageIndex]) {
        this.textPages[pageIndex].content = editable.nativeElement.innerHTML;
      }
    }
    
    // Restore focus
    editable.nativeElement.focus();
  }

  onContentEditableInput(pageIndex: number, event: Event): void {
    const editable = event.target as HTMLDivElement;
    if (this.textPages[pageIndex]) {
      this.textPages[pageIndex].content = editable.innerHTML;
    }
  }

  onContentEditableBlur(pageIndex: number, event: Event): void {
    const editable = event.target as HTMLDivElement;
    if (this.textPages[pageIndex]) {
      this.textPages[pageIndex].content = editable.innerHTML;
    }
  }

  loadRecentItems(): void {
    this.playlistService.getRecentlyModifiedLibraryItems().subscribe({
      next: (items) => {
        this.recentItems = items;
      },
      error: (error) => {
        console.error("Error loading recently modified library items:", error);
        this.recentItems = [];
      }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onRecentItemSelect(item: LibraryItem): void {
    // Recent items are returned without content for speed - fetch full item when selected
    this.playlistService.getLibraryItemByGuid(item.guid).subscribe({
      next: (fullItem) => {
        if (fullItem) {
          this.editItem(fullItem);
        } else {
          this.editItem(item);
        }
      },
      error: (error) => {
        console.error("Error loading full library item:", error);
        this.editItem(item);
      }
    });
  }

  onSearchResultSelect(item: LibraryItem): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    // Fetch the full item by GUID to ensure all pages are loaded correctly
    // Search results may have incomplete data, so we need to fetch the complete item
    this.playlistService.getLibraryItemByGuid(item.guid).subscribe({
      next: (fullItem) => {
        if (fullItem) {
          this.editItem(fullItem);
        } else {
          // Fallback to using the search result item if full item fetch fails
          this.editItem(item);
        }
      },
      error: (error) => {
        console.error("Error loading full library item:", error);
        // Fallback to using the search result item if fetch fails
        this.editItem(item);
      }
    });
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.showRecentItems = true;
    this.searchSubject.next("");
  }

  deleteItemFromList(item: LibraryItem): void {
    // Check if item is used in any playlist first
    this.playlistService.checkLibraryItemUsage(item.guid).subscribe({
      next: (usageInfo) => {
        if (usageInfo.isUsed) {
          const playlistNames = usageInfo.playlists.map(p => p.name).join(", ");
          this.showErrorPopup(`${this.translationService.translate('cannotDeleteItem')}. ${this.translationService.translate('itemUsedInPlaylistsDetail')} ${playlistNames}`);
          return;
        }

        // Show confirmation dialog
        this.itemToDeleteGuid = item.guid;
        this.confirmDialogTitle = this.translationService.translate('confirmDelete');
        this.confirmDialogMessage = `${this.translationService.translate('confirmDeleteMessage')}`;
        this.showConfirmDialog = true;
      },
      error: (error) => {
        console.error("Error checking library item usage:", error);
        this.showErrorPopup("Error checking library item usage. Please try again.");
      }
    });
  }

  editItem(item: LibraryItem): void {
    this.isNewItem = false;
    this.editingItem = { ...item };
    this.itemName = item.name;
    this.itemDescription = item.description || "";
    this.itemAuthor = item.author || "";
    this.itemDuration = (item as LibraryItem & { duration?: number | null }).duration ?? null;

    if (item.tags && Array.isArray(item.tags)) {
      this.selectedTagGuids = item.tags.map((t: { guid: number; name: string; description?: string }) => t.guid);
      this.selectedTags = item.tags.filter((t: { guid: number; name: string; description?: string }) =>
        this.allAvailableTags.some(tag => tag.guid === t.guid)
      );
    } else {
      this.selectedTagGuids = [];
      this.selectedTags = [];
    }

    // All items use pages - load from content array
    if (Array.isArray(item.content) && item.content.length > 0) {
      this.loadPagesForItem(item.guid, item.content);
      this.textPages = item.content.map((p: LibraryContent) => ({ page: p.page || 1, content: p.content || "" }));
    } else {
      this.textPages = [];
      this.pageReferences = [];
      this.allAvailablePages = [];
    }

    // Set color fields
    this.backgroundColor = item.background_color || "";
    this.fontColor = item.font_color || "";
    
    // Set CSS properties - convert object to JSON string for editing
    if (item.css && typeof item.css === 'object') {
      this.cssProperties = JSON.stringify(item.css, null, 2);
    } else {
      this.cssProperties = "";
    }
  }

  addNewItem(): void {
    this.isNewItem = true;
    this.editingItem = null;
    this.itemName = "";
    this.itemDescription = "";
    this.itemAuthor = "";
    this.itemDuration = null;
    this.textPages = [];
    this.pageReferences = [];
    this.allAvailablePages = [];
    this.selectedTagGuids = [];
    this.selectedTags = [];
    this.backgroundColor = "";
    this.fontColor = "";
    this.cssProperties = "";
  }

  cancelEdit(): void {
    this.editingItem = null;
    this.isNewItem = false;
    this.itemName = "";
    this.itemDescription = "";
    this.itemAuthor = "";
    this.itemDuration = null;
    this.textPages = [];
    this.pageReferences = [];
    this.selectedTagGuids = [];
    this.selectedTags = [];
    this.backgroundColor = "";
    this.fontColor = "";
    this.cssProperties = "";
    this.showRecentItems = true;
    this.showSearchResults = false;
    this.searchTerm = "";
    this.searchResults = [];
    this.loadRecentItems();
  }

  onPageDialogTypeChange(): void {
    this.pageDialogContent = '';
    this.pageDialogImagePreview = null;
    this.pageDialogImageBase64 = null;
    this.pageDialogUrl = '';
    this.pageDialogVideoUrl = '';
    this.pageDialogIframeContent = '';
    if (this.pageDialogType === 'image') {
      this.pageDialogImageHeight100 = true;
      this.pageDialogImageWidth100 = false;
    }
  }

  removePage(pageNumber: number): void {
    if (this.textPages.length > 1) {
      this.textPages = this.textPages.filter(p => p.page !== pageNumber);
      // Renumber pages sequentially
      this.textPages.forEach((page, index) => {
        page.page = index + 1;
      });
    }
  }
  
  // New page management methods
  openPageDialog(): void {
    this.newPageContent = '';
    this.showPageDialog = true;
  }
  
  closePageDialog(): void {
    this.showPageDialog = false;
    this.newPageContent = '';
  }
  
  openPageManageDialog(pageIndex: number): void {
    this.editingPageIndex = pageIndex;
    this.selectedReusablePageGuid = null;
    this.pageDialogType = 'text';
    this.pageDialogImagePreview = null;
    this.pageDialogImageBase64 = null;
    this.pageDialogUrl = '';
    this.pageDialogVideoUrl = '';
    this.pageDialogIframeContent = '';
    this.pageDialogCssProperties = '';
    this.pageDialogDuration = null;
    this.pageDialogImageHeight100 = true;
    this.pageDialogImageWidth100 = false;
    if (pageIndex >= 0 && pageIndex < this.pageReferences.length) {
      const ref = this.pageReferences[pageIndex];
      const page = ref.page || this.allAvailablePages.find(p => p.guid === ref.pageGuid);
      this.pageDialogType = (page?.type as any) || 'text';
      if (this.pageDialogType === 'text') {
        this.pageDialogContent = this.getPageContent(ref.pageGuid);
      } else if (this.pageDialogType === 'image' && page?.content) {
        this.pageDialogImageBase64 = page.content;
        this.pageDialogImagePreview = page.content.startsWith('data:image') ? page.content : `data:image/png;base64,${page.content}`;
      } else if (this.pageDialogType === 'url') {
        this.pageDialogUrl = this.getPageContent(ref.pageGuid);
      } else if (this.pageDialogType === 'video') {
        this.pageDialogVideoUrl = this.getPageContent(ref.pageGuid);
      } else if (this.pageDialogType === 'iframe') {
        this.pageDialogIframeContent = this.getPageContent(ref.pageGuid);
      }
      if (page?.css) {
        this.pageDialogCssProperties = typeof page.css === 'string' ? page.css : JSON.stringify(page.css, null, 2);
        if (this.pageDialogType === 'image') {
          const cssObj = typeof page.css === 'object' ? page.css : (() => { try { return JSON.parse(page.css as string); } catch { return {}; } })();
          this.pageDialogImageHeight100 = String(cssObj?.['height'] || '').trim() === '100%';
          this.pageDialogImageWidth100 = String(cssObj?.['width'] || '').trim() === '100%';
        }
      } else if (this.pageDialogType === 'image') {
        this.pageDialogImageHeight100 = true;
        this.pageDialogImageWidth100 = false;
      }
      if (page) {
        this.pageDialogDuration = (page as Page & { duration?: number | null }).duration ?? null;
      }
      this.activeTabIndex = 0;
    } else {
      this.pageDialogContent = '';
      this.activeTabIndex = 0;
    }
    this.showPageManageDialog = true;
    setTimeout(() => {
      if (this.pageContentEditable && this.pageDialogType === 'text') {
        this.pageContentEditable.nativeElement.innerHTML = this.pageDialogContent || '';
        this.setCaretToEnd(this.pageContentEditable.nativeElement);
      }
    }, 100);
  }
  
  onTabChange(value: number | string | undefined): void {
    // Update activeTabIndex when tab changes (value is already bound via [(value)])
    // Handle both number and string types from PrimeNG
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    // Clear selection when switching to create new tab
    if (numValue !== undefined && !isNaN(numValue) && numValue === 0) {
      this.selectedReusablePageGuid = null;
    }
  }
  
  setCaretToEnd(element: HTMLElement): void {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false); // false means collapse to end
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.focus();
  }
  
  getContentFromPageDialog(): string {
    if (this.pageContentEditable) {
      return this.pageContentEditable.nativeElement.innerHTML || '';
    }
    return this.pageDialogContent || '';
  }
  
  closePageManageDialog(): void {
    this.showPageManageDialog = false;
    this.editingPageIndex = -1;
    this.pageDialogContent = '';
    this.pageDialogType = 'text';
    this.pageDialogImagePreview = null;
    this.pageDialogImageBase64 = null;
    this.pageDialogUrl = '';
    this.pageDialogVideoUrl = '';
    this.pageDialogIframeContent = '';
    this.pageDialogCssProperties = '';
    this.pageDialogDuration = null;
    this.pageDialogImageHeight100 = true;
    this.pageDialogImageWidth100 = false;
    this.activeTabIndex = 0;
    this.selectedReusablePageGuid = null;
  }

  /** Build page CSS object from properties text + image toggles (for image type) */
  private getPageDialogCssForSave(): { [key: string]: string } | null {
    let obj: { [key: string]: string } = {};
    if (this.pageDialogCssProperties?.trim()) {
      try {
        const parsed = JSON.parse(this.pageDialogCssProperties.trim());
        if (parsed && typeof parsed === 'object') obj = { ...parsed };
      } catch { /* ignore */ }
    }
    if (this.pageDialogType === 'image') {
      if (this.pageDialogImageHeight100) obj['height'] = '100%';
      else delete obj['height'];
      if (this.pageDialogImageWidth100) obj['width'] = '100%';
      else delete obj['width'];
    }
    return Object.keys(obj).length > 0 ? obj : null;
  }

  onPageDialogImageToggleChange(): void {
    const obj = this.getPageDialogCssForSave();
    this.pageDialogCssProperties = obj ? JSON.stringify(obj, null, 2) : '';
  }
  
  getPageDialogHeader(): string {
    if (this.editingPageIndex >= 0) {
      const pageNumber = this.pageReferences[this.editingPageIndex]?.orderNumber || (this.editingPageIndex + 1);
      return `${this.translationService.translate('edit')} ${this.translationService.translate('page')} #${pageNumber}`;
    } else {
      const pageNumber = this.pageReferences.length + 1;
      return `${this.translationService.translate('addPage')} #${pageNumber}`;
    }
  }
  
  applyPageDialogFormatting(command: 'bold' | 'italic' | 'chord' | 'chi'): void {
    if (!this.pageContentEditable) return;
    
    const editable = this.pageContentEditable.nativeElement;
    if (!editable) return;
    
    // Focus the contenteditable div
    editable.focus();
    
    // Save current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // If no selection, can't apply chord or chi (needs text selection)
      if (command === 'chord' || command === 'chi') {
        return;
      }
      // For bold/italic, apply to entire content
      document.execCommand(command, false, undefined);
      return;
    }
    
    // Handle chord formatting specially
    if (command === 'chord') {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      
      if (selectedText) {
        // Check if selection is already wrapped in a chord tag
        let container: Node | null = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) {
          container = container.parentElement;
        }
        
        // Check if we're inside a chord tag (closest only exists on Element)
        let chordElement: Element | null = null;
        if (container && container.nodeType === Node.ELEMENT_NODE) {
          chordElement = (container as Element).closest('chord');
        }
        
        if (chordElement) {
          // Remove chord tag - unwrap
          const parent = chordElement.parentElement;
          if (parent) {
            while (chordElement.firstChild) {
              parent.insertBefore(chordElement.firstChild, chordElement);
            }
            parent.removeChild(chordElement);
            // Normalize to merge adjacent text nodes
            parent.normalize();
          }
        } else {
          // Wrap selection in chord tag
          const chordTag = document.createElement('chord');
          try {
            range.surroundContents(chordTag);
          } catch (e) {
            // If surroundContents fails, use extractContents
            const contents = range.extractContents();
            chordTag.appendChild(contents);
            range.insertNode(chordTag);
          }
        }
        
        // Update the model
        this.pageDialogContent = editable.innerHTML || '';
      }
    } else if (command === 'chi') {
      // Handle chi formatting specially (similar to chord)
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      
      if (selectedText) {
        // Check if selection is already wrapped in a chi tag
        let container: Node | null = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) {
          container = container.parentElement;
        }
        
        // Check if we're inside a chi tag (closest only exists on Element)
        let chiElement: Element | null = null;
        if (container && container.nodeType === Node.ELEMENT_NODE) {
          chiElement = (container as Element).closest('chi');
        }
        
        if (chiElement) {
          // Remove chi tag - unwrap
          const parent = chiElement.parentElement;
          if (parent) {
            while (chiElement.firstChild) {
              parent.insertBefore(chiElement.firstChild, chiElement);
            }
            parent.removeChild(chiElement);
            // Normalize to merge adjacent text nodes
            parent.normalize();
          }
        } else {
          // Wrap selection in chi tag
          const chiTag = document.createElement('chi');
          try {
            range.surroundContents(chiTag);
          } catch (e) {
            // If surroundContents fails, use extractContents
            const contents = range.extractContents();
            chiTag.appendChild(contents);
            range.insertNode(chiTag);
          }
        }
        
        // Update the model
        this.pageDialogContent = editable.innerHTML || '';
      }
    } else {
      // Apply standard formatting (bold/italic)
      document.execCommand(command, false, undefined);
    }
    
    // Restore focus
    editable.focus();
  }
  
  onPageDialogContentInput(event: Event): void {
    // Don't update the model on every input - this causes cursor to jump
    // We'll read the content when needed (blur or save)
    // Just keep the contenteditable in sync naturally
  }
  
  onPageDialogBlur(event: Event): void {
    // Update the model when user leaves the field
    const editable = event.target as HTMLDivElement;
    this.pageDialogContent = editable.innerHTML || '';
  }
  
  selectExistingPage(pageGuid: number | string): void {
    // Mark the page as selected (don't add it yet, wait for Save button)
    this.selectedReusablePageGuid = pageGuid;
  }
  
  isPageSelected(pageGuid: number | string): boolean {
    return this.selectedReusablePageGuid === pageGuid;
  }
  
  canSavePageFromDialog(): boolean {
    if (this.activeTabIndex === 1) {
      return this.selectedReusablePageGuid !== null;
    }
    if (this.pageDialogType === 'text') {
      return this.getContentFromPageDialog().trim().length > 0;
    }
    if (this.pageDialogType === 'image') {
      return !!(this.pageDialogImageBase64 || this.pageDialogImagePreview);
    }
    if (this.pageDialogType === 'url') {
      return this.pageDialogUrl.trim().length > 0;
    }
    if (this.pageDialogType === 'video') {
      return this.pageDialogVideoUrl.length > 0;
    }
    if (this.pageDialogType === 'iframe') {
      return this.pageDialogIframeContent.trim().length > 0;
    }
    return false;
  }
  
  savePageFromDialog(): void {
    // Check if we're on the reuse tab and a page is selected
    if (this.activeTabIndex === 1 && this.selectedReusablePageGuid !== null) {
      // Add the selected reusable page
      const page = this.allAvailablePages.find(p => p.guid === this.selectedReusablePageGuid);
      if (!page) {
        console.warn("Selected page not found:", this.selectedReusablePageGuid);
        return;
      }
      
      if (this.editingPageIndex >= 0 && this.editingPageIndex < this.pageReferences.length) {
        // Replace existing page reference (editing mode)
        this.pageReferences[this.editingPageIndex].pageGuid = this.selectedReusablePageGuid!;
        this.pageReferences[this.editingPageIndex].page = page;
      } else {
        // Adding new page reference - allow reusing pages (they can be used multiple times)
        // Users can reuse the same page multiple times in different positions
        const orderNumber = this.pageReferences.length > 0 
          ? Math.max(...this.pageReferences.map(r => r.orderNumber), 0) + 1
          : 1;
        
        this.pageReferences.push({
          pageGuid: this.selectedReusablePageGuid!,
          orderNumber: orderNumber,
          page: page
        });
      }
      
      this.closePageManageDialog();
      return;
    }
    
    // Create/edit page - get content based on type
    let content = '';
    if (this.pageDialogType === 'text') {
      content = this.getContentFromPageDialog().trim();
    } else if (this.pageDialogType === 'image') {
      content = this.pageDialogImageBase64 || (this.pageDialogImagePreview ? this.pageDialogImagePreview.split(',')[1] || this.pageDialogImagePreview : '') || '';
    } else if (this.pageDialogType === 'url') {
      content = this.pageDialogUrl.trim();
    } else if (this.pageDialogType === 'video') {
      content = this.pageDialogVideoUrl;
    } else if (this.pageDialogType === 'iframe') {
      content = this.pageDialogIframeContent.trim();
    }
    if (!content && this.pageDialogType !== 'text') {
      return;
    }
    if (this.pageDialogType === 'text' && !content) {
      return;
    }

    if (this.editingPageIndex >= 0 && this.editingPageIndex < this.pageReferences.length) {
      const ref = this.pageReferences[this.editingPageIndex];
      if (typeof ref.pageGuid === 'number' && ref.pageGuid > 0) {
        const pageCss = this.getPageDialogCssForSave();
        this.pagesService.updatePage(ref.pageGuid, content, this.pageDialogType, pageCss, this.pageDialogDuration).subscribe({
          next: (updatedPage) => {
            ref.page = { ...updatedPage, type: this.pageDialogType, css: pageCss ?? undefined };
            const idx = this.allAvailablePages.findIndex(p => p.guid === ref.pageGuid);
            if (idx >= 0) {
              this.allAvailablePages[idx] = { ...updatedPage, type: this.pageDialogType, css: pageCss ?? undefined };
            }
            this.closePageManageDialog();
          },
          error: (error) => {
            console.error("Error updating page:", error);
            this.showErrorPopup("Error updating page. Please try again.");
          }
        });
      } else {
        const pageCss = this.getPageDialogCssForSave();
        if (ref.page) {
          ref.page.content = content;
          ref.page.type = this.pageDialogType;
          ref.page.css = pageCss ?? undefined;
        }
        const pageIndex = this.allAvailablePages.findIndex(p => p.guid === ref.pageGuid);
        if (pageIndex >= 0) {
          this.allAvailablePages[pageIndex] = { ...this.allAvailablePages[pageIndex], content, type: this.pageDialogType, css: pageCss ?? undefined };
        }
        this.closePageManageDialog();
      }
    } else {
      const pageCss = this.getPageDialogCssForSave();
      const temporalPageGuid = this.nextTemporalId--;
      const temporalPage: Page = {
        guid: temporalPageGuid,
        content: content,
        type: this.pageDialogType,
        css: pageCss ?? undefined,
        duration: this.pageDialogDuration ?? undefined,
        isTemporal: true
      };
      
      // Add to available pages
      if (!this.allAvailablePages.find(p => p.guid === temporalPageGuid)) {
        this.allAvailablePages.push(temporalPage);
      }
      
      // Add to page references
      const orderNumber = this.pageReferences.length > 0 
        ? Math.max(...this.pageReferences.map(r => r.orderNumber), 0) + 1
        : 1;
      
      this.pageReferences.push({
        pageGuid: temporalPageGuid,
        orderNumber: orderNumber,
        page: temporalPage
      });
      
      this.closePageManageDialog();
    }
  }
  
  saveNewPage(): void {
    const content = this.newPageContent.trim();
    
    if (!content) {
      // Don't create empty pages
      return;
    }
    
    // Create a temporal page (not saved to DB yet) - only on client side
    const temporalPageGuid = this.nextTemporalId--;
    const temporalPage: Page = {
      guid: temporalPageGuid,
      content: content,
      isTemporal: true
    };
    
    // Add to available pages for this item (can be selected from page selector later)
    // Check if already exists (shouldn't happen, but just in case)
    if (!this.allAvailablePages.find(p => p.guid === temporalPageGuid)) {
      this.allAvailablePages.push(temporalPage);
    }
    
    // Don't automatically add to page references - user must select it from the page selector
    // This allows creating pages without immediately using them
    
    this.closePageDialog();
  }
  
  // Legacy method - kept for backward compatibility, now opens dialog
  createNewPageAndAdd(content: string = ''): void {
    this.openPageDialog();
    if (content) {
      this.newPageContent = content;
    }
  }
  
  addExistingPage(pageGuid: number | string): void {
    // Allow adding pages from current item's pages (can reuse pages multiple times)
    const page = this.allAvailablePages.find(p => p.guid === pageGuid);
    if (!page) {
      // Page not found in current item's pages - shouldn't happen if selector is filtered correctly
      console.warn("Page not found in current item's pages:", pageGuid);
      return;
    }
    
    // Allow reusing pages - they can be added multiple times in different positions
    const orderNumber = this.pageReferences.length > 0 
      ? Math.max(...this.pageReferences.map(r => r.orderNumber), 0) + 1
      : 1;
    
    this.pageReferences.push({
      pageGuid: page.guid,
      orderNumber: orderNumber,
      page: page
    });
    this.showPageSelector = false;
  }
  
  removePageReference(index: number): void {
    if (index < 0 || index >= this.pageReferences.length) {
      return;
    }
    
    const pageRef = this.pageReferences[index];
    
    // Show confirmation dialog - store index, pageGuid, and orderNumber for safety
    // orderNumber is unique for each page reference, so it's the most reliable identifier
    this.pageToRemoveIndex = index;
    this.pageToRemoveGuid = pageRef.pageGuid;
    this.pageToRemoveOrderNumber = pageRef.orderNumber;
    
    this.confirmDialogTitle = this.translationService.translate('removePage') || 'Remove Page';
    this.confirmDialogMessage = this.translationService.translate('confirmRemovePage') || 
      `Are you sure you want to remove this page from the song? You need to save the item for the change to be permanent.`;
    this.showConfirmPageRemoveDialog = true;
  }
  
  onConfirmRemovePage(): void {
    // Find the page reference by orderNumber (most reliable - unique for each reference)
    // Fallback to pageGuid + index if orderNumber match fails
    let indexToRemove = -1;
    
    if (this.pageToRemoveOrderNumber >= 0) {
      // Find by orderNumber (most reliable - unique for each reference)
      indexToRemove = this.pageReferences.findIndex(ref => ref.orderNumber === this.pageToRemoveOrderNumber);
    }
    
    // Fallback 1: Try by pageGuid + stored index
    if (indexToRemove < 0 && this.pageToRemoveGuid !== null && this.pageToRemoveGuid !== undefined) {
      // If pageGuid appears multiple times, use the one at stored index
      if (this.pageToRemoveIndex >= 0 && this.pageToRemoveIndex < this.pageReferences.length) {
        const refAtStoredIndex = this.pageReferences[this.pageToRemoveIndex];
        if (refAtStoredIndex && refAtStoredIndex.pageGuid === this.pageToRemoveGuid) {
          indexToRemove = this.pageToRemoveIndex;
        }
      }
    }
    
    // Fallback 2: Use stored index if it's still valid
    if (indexToRemove < 0 && this.pageToRemoveIndex >= 0 && this.pageToRemoveIndex < this.pageReferences.length) {
      indexToRemove = this.pageToRemoveIndex;
    }
    
    if (indexToRemove < 0 || indexToRemove >= this.pageReferences.length) {
      this.closeConfirmPageRemoveDialog();
      return;
    }
    
    // Remove the page reference at the found index
    this.pageReferences.splice(indexToRemove, 1);
    
    // Renumber order
    this.pageReferences.forEach((ref, i) => {
      ref.orderNumber = i + 1;
    });
    
    // Also update textPages to keep them in sync
    if (this.textPages.length > indexToRemove) {
      this.textPages.splice(indexToRemove, 1);
      // Renumber textPages
      this.textPages.forEach((page, i) => {
        page.page = i + 1;
      });
    }
    
    this.closeConfirmPageRemoveDialog();
  }
  
  closeConfirmPageRemoveDialog(): void {
    this.showConfirmPageRemoveDialog = false;
    this.pageToRemoveIndex = -1;
    this.pageToRemoveGuid = null;
    this.pageToRemoveOrderNumber = -1;
  }
  
  movePageUp(index: number): void {
    if (index > 0) {
      const temp = this.pageReferences[index];
      this.pageReferences[index] = this.pageReferences[index - 1];
      this.pageReferences[index - 1] = temp;
      // Update order numbers
      this.pageReferences.forEach((ref, i) => {
        ref.orderNumber = i + 1;
      });
    }
  }
  
  movePageDown(index: number): void {
    if (index < this.pageReferences.length - 1) {
      const temp = this.pageReferences[index];
      this.pageReferences[index] = this.pageReferences[index + 1];
      this.pageReferences[index + 1] = temp;
      // Update order numbers
      this.pageReferences.forEach((ref, i) => {
        ref.orderNumber = i + 1;
      });
    }
  }
  
  openPageSelector(index: number): void {
    this.pageSelectorIndex = index;
    // Ensure allAvailablePages includes temporal pages
    // Filter to only show pages from current library item (already done in loadPagesForItem)
    // Exclude pages already in pageReferences
    this.showPageSelector = true;
  }
  
  openPageDialogFromSelector(): void {
    // Close page selector and open page dialog
    this.closePageSelector();
    this.openPageDialog();
  }
  
  getAvailablePagesForSelector(): Page[] {
    // Return all pages from current library item (including newly created temporal pages)
    // Users can reuse any page from the current library item
    // Filter to exclude the currently editing page (if any) to avoid confusion
    const pages = [...this.allAvailablePages];
    
    if (this.editingPageIndex >= 0 && this.editingPageIndex < this.pageReferences.length) {
      const editingPageGuid = this.pageReferences[this.editingPageIndex].pageGuid;
      return pages.filter(page => page.guid !== editingPageGuid);
    }
    
    // Show all available pages if not editing a specific page
    return pages;
  }
  
  closePageSelector(): void {
    this.showPageSelector = false;
    this.pageSelectorIndex = -1;
  }
  
  getPageContent(pageGuid: number | string): string {
    const page = this.allAvailablePages.find(p => p.guid === pageGuid);
    return page ? (page.content || '') : '';
  }

  getPageType(pageGuid: number | string): string {
    const page = this.allAvailablePages.find(p => p.guid === pageGuid);
    return page?.type || 'text';
  }

  getPageImagePreview(pageGuid: number | string): string | null {
    const page = this.allAvailablePages.find(p => p.guid === pageGuid);
    if (!page || page.type !== 'image' || !page.content) return null;
    const c = page.content;
    return c.startsWith('data:image') ? c : `data:image/png;base64,${c}`;
  }
  
  getPagePreviewText(page: Page | { content?: string; type?: string }): string {
    const content = page?.content;
    const type = page?.type || 'text';
    if (!content) return type === 'text' ? '(empty)' : `(${type})`;
    if (type === 'image') return '(image)';
    if (type === 'video') return '(video)';
    if (type === 'iframe') return '(iframe)';
    if (type === 'url') return content.length > 60 ? content.substring(0, 60) + '...' : content;
    const text = content.replace(/<[^>]*>/g, '').trim();
    return text.length > 200 ? text.substring(0, 200) + '...' : text || '(empty)';
  }
  
  updatePageContent(pageGuid: number, content: string): void {
    this.pagesService.updatePage(pageGuid, content).subscribe({
      next: (updatedPage) => {
        // Update in all available pages
        const index = this.allAvailablePages.findIndex(p => p.guid === pageGuid);
        if (index >= 0) {
          this.allAvailablePages[index] = updatedPage;
        }
        // Update in page references
        const ref = this.pageReferences.find(r => r.pageGuid === pageGuid);
        if (ref) {
          ref.page = updatedPage;
        }
      },
      error: (error) => {
        console.error("Error updating page:", error);
        this.showErrorPopup("Error updating page. Please try again.");
      }
    });
  }
  
  // Legacy method - kept for compatibility, but PrimeNG MultiSelect handles this automatically
  toggleTag(tagGuid: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      if (!this.selectedTagGuids.includes(tagGuid)) {
        this.selectedTagGuids.push(tagGuid);
      }
      // Sync with selectedTags
      const tag = this.allAvailableTags.find(t => t.guid === tagGuid);
      if (tag && !this.selectedTags.some(t => t.guid === tagGuid)) {
        this.selectedTags.push(tag);
      }
    } else {
      this.selectedTagGuids = this.selectedTagGuids.filter(g => g !== tagGuid);
      this.selectedTags = this.selectedTags.filter(t => t.guid !== tagGuid);
    }
  }

  onPageDialogImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.pageDialogImagePreview = e.target.result;
        const base64String = e.target.result.split(',')[1] || e.target.result;
        this.pageDialogImageBase64 = base64String;
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  onPageDialogVideoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.uploadPageDialogVideo(input.files[0]);
    }
  }

  uploadPageDialogVideo(file: File): void {
    this.pageDialogVideoUploading = true;
    const formData = new FormData();
    formData.append('video', file);

    // Get authentication headers
    const username = localStorage.getItem('admin_username');
    let headers = new HttpHeaders();
    if (username) {
      headers = headers.set('Authorization', `Bearer ${username}`);
    }
    // Don't set Content-Type for FormData - let browser set it with boundary

    this.http.post<{ success: boolean; filename: string; url: string }>(`${environment.apiUrl}/library/upload-video`, formData, {
      headers: headers
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.pageDialogVideoUrl = response.url.startsWith('/') ? response.url : response.url;
          this.pageDialogVideoUploading = false;
        } else {
          this.showErrorPopup('Failed to upload video');
          this.pageDialogVideoUploading = false;
        }
      },
      error: (error) => {
        console.error('Video upload error:', error);
        this.showErrorPopup(error.error?.message || 'Failed to upload video');
        this.pageDialogVideoUploading = false;
      }
    });
  }

  showErrorPopup(message: string): void {
    this.errorMessage = message;
    this.showError = true;
  }

  closeErrorPopup(): void {
    this.showError = false;
    this.errorMessage = "";
  }

  saveItem(): void {
    if (!this.itemName.trim()) {
      this.showErrorPopup(this.translationService.translate('nameRequired'));
      return;
    }
    if (this.pageReferences.length === 0) {
      this.showErrorPopup("Please add at least one page");
      return;
    }

    // Always set author (use empty string for empty author, server will convert to null)
    // HTTP client might filter null values, so use empty string to ensure field is always present
    const authorValue = this.itemAuthor ? this.itemAuthor.trim() : '';
    const authorForPayload = authorValue || ''; // Use empty string instead of null to ensure it's included in payload
    
    // Parse CSS properties from JSON string to object
    let cssObj: { [key: string]: string } | undefined = undefined;
    if (this.cssProperties.trim()) {
      try {
        const parsed = JSON.parse(this.cssProperties.trim());
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          cssObj = parsed;
        } else {
          this.showErrorPopup("CSS properties must be a valid JSON object");
          return;
        }
      } catch (e) {
        this.showErrorPopup("CSS properties must be valid JSON format");
        return;
      }
    }
    
    const itemData: Partial<LibraryItem & { pageGuids?: number[]; tagGuids?: number[] }> = {
      name: this.itemName.trim(),
      description: this.itemDescription.trim() || undefined,
      background_color: this.backgroundColor.trim() || undefined,
      font_color: this.fontColor.trim() || undefined,
      css: cssObj,
      author: authorForPayload,
      duration: this.itemDuration != null && this.itemDuration > 0 ? this.itemDuration : null
    };

    const sortedPageReferences = [...this.pageReferences].sort((a, b) => a.orderNumber - b.orderNumber);
    const pageGuids: Array<{ guid: number; orderNumber: number }> = [];
    const temporalPagesWithOrder: Array<{ page: Page; orderNumber: number }> = [];

    sortedPageReferences.forEach(ref => {
      const pg = ref.pageGuid;
      if ((typeof pg === 'number' && pg < 0) || (typeof pg === 'string' && parseInt(pg, 10) < 0)) {
        if (ref.page) {
          temporalPagesWithOrder.push({ page: ref.page, orderNumber: ref.orderNumber });
        }
      } else if (typeof pg === 'number' && pg > 0) {
        pageGuids.push({ guid: pg, orderNumber: ref.orderNumber });
      }
    });

    if (temporalPagesWithOrder.length > 0) {
      const createObservables = temporalPagesWithOrder.map(({ page }) =>
        this.pagesService.createPage(page.content || '', page.type || 'text', page.css, page.duration ?? undefined)
      );
      forkJoin(createObservables).subscribe({
        next: (newPages) => {
          newPages.forEach((newPage, index) => {
            if (typeof newPage.guid === 'number') {
              pageGuids.push({
                guid: newPage.guid,
                orderNumber: temporalPagesWithOrder[index].orderNumber
              });
            }
          });
          pageGuids.sort((a, b) => a.orderNumber - b.orderNumber);
          itemData.pageGuids = pageGuids.map(p => p.guid);
          if (this.selectedTags?.length > 0) {
            itemData.tagGuids = this.selectedTags.map(tag => tag.guid);
          } else {
            itemData.tagGuids = [];
          }
          this.proceedWithSave(itemData);
        },
        error: (error) => {
          console.error("Error creating temporal pages:", error);
          this.showErrorPopup("Error creating pages. Please try again.");
        }
      });
      return;
    }

    itemData.pageGuids = pageGuids.sort((a, b) => a.orderNumber - b.orderNumber).map(p => p.guid);
    if (this.selectedTags && this.selectedTags.length > 0) {
      this.selectedTagGuids = this.selectedTags.map(tag => tag.guid);
      itemData.tagGuids = this.selectedTagGuids;
    } else {
      this.selectedTagGuids = [];
      itemData.tagGuids = [];
    }
    this.proceedWithSave(itemData);
  }
  
  proceedWithSave(itemData: any): void {
    if (this.isNewItem) {
      // Create new item
      this.playlistService.createLibraryItem(itemData).subscribe({
        next: (newItem) => {
          console.log("Library item created:", newItem);
          this.cancelEdit();
          // Refresh the recently modified items list to show the new item on top
          this.loadRecentItems();
        },
        error: (error) => {
          console.error("Error creating library item:", error);
          this.showErrorPopup("Error creating library item. Please try again.");
        }
      });
    } else if (this.editingItem) {
      // Update existing item
      // Ensure author is explicitly set (use empty string for empty author, server will convert to null)
      // Use empty string instead of null to ensure it's included in payload
      const authorForUpdate = itemData.author !== undefined ? itemData.author : (this.itemAuthor ? this.itemAuthor.trim() || '' : '');
      
      // Build updatedItem explicitly to ensure author is always included
      const updatedItem: LibraryItem & { pageGuids?: number[]; tagGuids?: number[]; duration?: number | null } = {
        guid: this.editingItem.guid,
        name: itemData.name !== undefined ? itemData.name : this.editingItem.name,
        type: this.editingItem.type,
        content: this.editingItem.content,
        description: itemData.description !== undefined ? itemData.description : this.editingItem.description,
        background_color: itemData.background_color !== undefined ? itemData.background_color : this.editingItem.background_color,
        font_color: itemData.font_color !== undefined ? itemData.font_color : this.editingItem.font_color,
        css: itemData.css !== undefined ? itemData.css : this.editingItem.css,
        modified: itemData.modified || new Date().toISOString(),
        // Explicitly set author to ensure it's included in payload even if null
        author: authorForUpdate,
        duration: itemData.duration !== undefined ? itemData.duration : (this.editingItem as LibraryItem & { duration?: number | null }).duration ?? null,
        // Include pageGuids and tagGuids if they exist
        ...(itemData.pageGuids !== undefined && { pageGuids: itemData.pageGuids }),
        ...(itemData.tagGuids !== undefined && { tagGuids: itemData.tagGuids })
      };
      
      // Debug: log author value being sent
      console.log("Saving item - author value:", authorForUpdate, "itemData.author:", itemData.author, "updatedItem.author:", updatedItem.author, "updatedItem:", JSON.stringify(updatedItem));
      
      this.playlistService.updateLibraryItem(updatedItem).subscribe({
        next: (result) => {
          console.log("Library item updated:", result);
          this.loadRecentItems();
          this.cancelEdit();
        },
        error: (error) => {
          console.error("Error updating library item:", error);
          this.showErrorPopup("Error updating library item. Please try again.");
        }
      });
    }
  }

  deleteItem(): void {
    if (!this.editingItem) {
      return;
    }

    // Show confirmation dialog
    this.itemToDeleteGuid = this.editingItem.guid;
    this.confirmDialogTitle = this.translationService.translate('confirmDelete');
    this.confirmDialogMessage = `${this.translationService.translate('confirmDeleteMessage')}`;
    this.showConfirmDialog = true;
  }

  onConfirmDelete(): void {
    if (this.itemToDeleteGuid === null) {
      return;
    }

    const guidToDelete = this.itemToDeleteGuid;
    const itemName = this.editingItem?.name || this.recentItems.find(item => item.guid === guidToDelete)?.name || "this item";
    
    // Check if item is used in any playlist before deleting
    this.playlistService.checkLibraryItemUsage(guidToDelete).subscribe({
      next: (usageInfo) => {
        if (usageInfo.isUsed) {
          const playlistNames = usageInfo.playlists.map(p => p.name).join(", ");
          this.showErrorPopup(`${this.translationService.translate('cannotDeleteItem')}. ${this.translationService.translate('itemUsedInPlaylistsDetail')} ${playlistNames}`);
          this.closeConfirmDialog();
          return;
        }

        // Immediately remove from recent items array (optimistic update)
        this.recentItems = this.recentItems.filter(item => item.guid !== guidToDelete);
        
        // Immediately remove from search results if present
        this.searchResults = this.searchResults.filter(item => item.guid !== guidToDelete);
        
        // Delete the item
        this.playlistService.deleteLibraryItem(guidToDelete).subscribe({
          next: () => {
            console.log("Library item deleted");
            // Reload recent items to ensure consistency
            this.loadRecentItems();
            if (this.editingItem?.guid === guidToDelete) {
              this.cancelEdit();
            }
            this.closeConfirmDialog();
          },
          error: (error) => {
            console.error("Error deleting library item:", error);
            // Reload on error to restore correct state
            this.loadRecentItems();
            this.showErrorPopup("Error deleting library item. Please try again.");
            this.closeConfirmDialog();
          }
        });
      },
      error: (error) => {
        console.error("Error checking library item usage:", error);
        this.showErrorPopup("Error checking library item usage. Please try again.");
        this.closeConfirmDialog();
      }
    });
  }

  closeConfirmDialog(): void {
    this.showConfirmDialog = false;
    this.itemToDeleteGuid = null;
    this.confirmDialogTitle = "";
    this.confirmDialogMessage = "";
  }

  hasDeletePermission(): boolean {
    return this.hasManageLibraryPermission();
  }
}
