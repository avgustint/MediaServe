import { Component, OnInit, ViewChild, ElementRef, QueryList, ViewChildren, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PlaylistService, LibraryItem, LibraryContent } from "../../playlist.service";
import { PagesService, Page } from "../../pages.service";
import { TagsService, Tag } from "../../tags.service";
import { UserService } from "../../user.service";
import { ErrorPopupComponent } from "../../shared/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../../shared/confirm-dialog/confirm-dialog.component";
import { TranslatePipe } from "../../translation.pipe";
import { LocalizedDatePipe } from "../../localized-date.pipe";
import { TranslationService } from "../../translation.service";
import { debounceTime, distinctUntilChanged, Subject, switchMap, of, forkJoin } from "rxjs";
import { InputTextModule } from "primeng/inputtext";
import { TextareaModule } from "primeng/textarea";
import { SelectModule } from "primeng/select";
import { MultiSelectModule } from "primeng/multiselect";
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { TabsModule } from "primeng/tabs";

@Component({
  selector: "app-library-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent, ConfirmDialogComponent, TranslatePipe, LocalizedDatePipe, InputTextModule, TextareaModule, SelectModule, MultiSelectModule, ButtonModule, DialogModule, TabsModule],
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
  itemType: "text" | "image" | "url" = "text";
  itemDescription: string = "";
  itemAuthor: string = "";
  
  // Dropdown options
  typeOptions: Array<{ label: string; value: "text" | "image" | "url" }> = [];
  
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
  
  // Image type field
  imageFile: File | null = null;
  imagePreview: string | null = null;
  imageBase64: string | null = null;
  
  // URL type field
  urlContent: string = "";

  // Color fields
  backgroundColor: string = "";
  fontColor: string = "";

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  // Confirm dialog
  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = "";
  confirmDialogMessage: string = "";
  itemToDeleteGuid: number | null = null;

  constructor(
    private playlistService: PlaylistService,
    private pagesService: PagesService,
    private tagsService: TagsService,
    private userService: UserService,
    private translationService: TranslationService
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
      { label: this.translationService.translate('url'), value: 'url' }
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
      },
      error: (error) => {
        console.error("Error loading pages for item:", error);
        // Keep temporal pages even if loading fails
        const temporalPages = this.allAvailablePages.filter(p => p.isTemporal);
        this.allAvailablePages = temporalPages;
        this.pageReferences = [];
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
    // After view init, set HTML content in contenteditable divs if editing existing item
    if (this.editingItem && this.itemType === 'text') {
      setTimeout(() => {
        this.updateContentEditableDivs();
      }, 0);
    }
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

  applyFormatting(pageIndex: number, command: 'bold' | 'italic'): void {
    const editable = this.contentEditables.toArray()[pageIndex];
    if (!editable) return;

    // Focus the contenteditable div
    editable.nativeElement.focus();
    
    // Save current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // If no selection, apply to entire content
      document.execCommand(command, false, undefined);
      return;
    }

    // Apply formatting to selection
    document.execCommand(command, false, undefined);
    
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

  onSearchResultSelect(item: LibraryItem): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.editItem(item);
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
          this.showErrorPopup(`Cannot delete library item "${item.name}". It is used in the following playlist(s): ${playlistNames}`);
          return;
        }

        // Show confirmation dialog
        this.itemToDeleteGuid = item.guid;
        this.confirmDialogTitle = "Delete Library Item";
        this.confirmDialogMessage = `Are you sure you want to delete library item "${item.name}"? This action cannot be undone.`;
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
    this.itemType = item.type;
    this.itemDescription = item.description || "";
    this.itemAuthor = item.author || "";
    
    // Load tags for this item
    if (item.tags && Array.isArray(item.tags)) {
      this.selectedTagGuids = item.tags.map((t: { guid: number; name: string; description?: string }) => t.guid);
      // Sync selectedTags for PrimeNG MultiSelect
      this.selectedTags = item.tags.filter((t: { guid: number; name: string; description?: string }) => 
        this.allAvailableTags.some(tag => tag.guid === t.guid)
      );
    } else {
      this.selectedTagGuids = [];
      this.selectedTags = [];
    }
    
    // For text items, load pages from the item
    if (item.type === "text") {
      if (Array.isArray(item.content)) {
        // Content is already formatted as pages array - load pages by their content
        // We need to find pages in database that match the content or load them if they have GUIDs
        this.loadPagesForItem(item.guid, item.content);
        this.textPages = [...item.content];
      } else {
        this.textPages = [{ page: 1, content: item.content as string || "" }];
        this.pageReferences = [];
        this.allAvailablePages = [];
      }
    } else {
      this.textPages = [];
      this.pageReferences = [];
      this.allAvailablePages = [];
    }

    if (item.type === "image") {
      this.imageBase64 = item.content as string;
      this.imagePreview = item.content as string;
      if (!this.imagePreview.startsWith("data:image")) {
        this.imagePreview = `data:image/png;base64,${this.imagePreview}`;
      }
    } else {
      this.imageFile = null;
      this.imagePreview = null;
      this.imageBase64 = null;
    }

    if (item.type === "url") {
      this.urlContent = item.content as string;
    } else {
      this.urlContent = "";
    }

    // Set color fields
    this.backgroundColor = item.background_color || "";
    this.fontColor = item.font_color || "";
  }

  addNewItem(): void {
    this.isNewItem = true;
    this.editingItem = null;
    this.itemName = "";
    this.itemType = "text";
    this.itemDescription = "";
    this.itemAuthor = "";
    this.textPages = [];
    this.pageReferences = [];
    this.allAvailablePages = []; // Clear pages for new item
    this.selectedTagGuids = [];
    this.selectedTags = [];
    this.imageFile = null;
    this.imagePreview = null;
    this.imageBase64 = null;
    this.urlContent = "";
    this.backgroundColor = "";
    this.fontColor = "";
  }

  cancelEdit(): void {
    this.editingItem = null;
    this.isNewItem = false;
    this.itemName = "";
    this.itemType = "text";
    this.itemDescription = "";
    this.itemAuthor = "";
    this.textPages = [];
    this.pageReferences = [];
    this.selectedTagGuids = [];
    this.selectedTags = [];
    this.imageFile = null;
    this.imagePreview = null;
    this.imageBase64 = null;
    this.urlContent = "";
    this.backgroundColor = "";
    this.fontColor = "";
    this.loadRecentItems();
  }

  onTypeChange(): void {
    // Reset content when type changes
    if (this.itemType === "text") {
      this.textPages = [{ page: 1, content: "" }];
      this.imageFile = null;
      this.imagePreview = null;
      this.imageBase64 = null;
      this.urlContent = "";
    } else if (this.itemType === "image") {
      this.textPages = [{ page: 1, content: "" }];
      this.urlContent = "";
      this.imageFile = null;
      this.imagePreview = null;
      this.imageBase64 = null;
    } else if (this.itemType === "url") {
      this.textPages = [{ page: 1, content: "" }];
      this.imageFile = null;
      this.imagePreview = null;
      this.imageBase64 = null;
      this.urlContent = "";
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
  
  // New page manage dialog with tabs
  openPageManageDialog(pageIndex: number): void {
    this.editingPageIndex = pageIndex;
    this.selectedReusablePageGuid = null; // Reset selection when opening dialog
    if (pageIndex >= 0 && pageIndex < this.pageReferences.length) {
      // Editing existing page - load its content
      const ref = this.pageReferences[pageIndex];
      this.pageDialogContent = this.getPageContent(ref.pageGuid);
      this.activeTabIndex = 0; // Show Create tab when editing
    } else {
      // Adding new page
      this.pageDialogContent = '';
      this.activeTabIndex = 0; // Start with Create tab
    }
    this.showPageManageDialog = true;
    // Update contenteditable div after view updates - only set once, don't bind
    setTimeout(() => {
      if (this.pageContentEditable) {
        this.pageContentEditable.nativeElement.innerHTML = this.pageDialogContent || '';
        // Set cursor at the end of content
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
    this.activeTabIndex = 0;
    this.selectedReusablePageGuid = null;
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
  
  applyPageDialogFormatting(command: 'bold' | 'italic'): void {
    if (!this.pageContentEditable) return;
    
    const editable = this.pageContentEditable.nativeElement;
    if (!editable) return;
    
    // Focus the contenteditable div
    editable.focus();
    
    // Save current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // If no selection, apply to entire content
      document.execCommand(command, false, undefined);
      return;
    }
    
    // Apply formatting to selection
    document.execCommand(command, false, undefined);
    
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
    if (this.activeTabIndex === 0) {
      // Create new page tab - can save if there's content
      const content = this.getContentFromPageDialog();
      return content.trim().length > 0;
    } else if (this.activeTabIndex === 1) {
      // Reuse existing page tab - can save if a page is selected
      return this.selectedReusablePageGuid !== null;
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
    
    // Otherwise, handle creating/editing a new page
    // Get current content from the contenteditable div directly
    const content = this.getContentFromPageDialog().trim();
    
    if (!content) {
      // Don't create empty pages
      return;
    }
    
    if (this.editingPageIndex >= 0 && this.editingPageIndex < this.pageReferences.length) {
      // Update existing page
      const ref = this.pageReferences[this.editingPageIndex];
      
      if (typeof ref.pageGuid === 'number' && ref.pageGuid > 0) {
        // Update existing page in database
        this.pagesService.updatePage(ref.pageGuid, content).subscribe({
          next: (updatedPage) => {
            // Update in page references
            ref.page = updatedPage;
            // Update in all available pages
            const index = this.allAvailablePages.findIndex(p => p.guid === ref.pageGuid);
            if (index >= 0) {
              this.allAvailablePages[index] = updatedPage;
            }
            this.closePageManageDialog();
          },
          error: (error) => {
            console.error("Error updating page:", error);
            this.showErrorPopup("Error updating page. Please try again.");
          }
        });
      } else {
        // Temporal page - update content directly
        if (ref.page) {
          ref.page.content = content;
        }
        // Update in all available pages
        const pageIndex = this.allAvailablePages.findIndex(p => p.guid === ref.pageGuid);
        if (pageIndex >= 0) {
          this.allAvailablePages[pageIndex].content = content;
        }
        this.closePageManageDialog();
      }
    } else {
      // Create new temporal page
      const temporalPageGuid = this.nextTemporalId--;
      const temporalPage: Page = {
        guid: temporalPageGuid,
        content: content,
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
    this.pageReferences.splice(index, 1);
    // Renumber order
    this.pageReferences.forEach((ref, i) => {
      ref.orderNumber = i + 1;
    });
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
    return page ? page.content : '';
  }
  
  getPagePreviewText(content: string | undefined): string {
    if (!content) return '(empty)';
    // Strip HTML tags and get first 200 characters
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

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.imageFile = input.files[0];
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
        // Extract base64 without data URI prefix
        const base64String = e.target.result.split(',')[1] || e.target.result;
        this.imageBase64 = base64String;
      };
      reader.readAsDataURL(this.imageFile);
    }
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

    let content: string | LibraryContent[] | undefined;

    if (this.itemType === "text") {
      // For text items, use page management system
      if (this.pageReferences.length > 0) {
        // New page-based system - content will be empty, pageGuids will be sent
        content = ""; // Empty for text items using pages
      } else {
        // Legacy system - get HTML content from contenteditable divs
        this.textPages.forEach((page, index) => {
          const htmlContent = this.getContentFromEditable(index);
          page.content = htmlContent;
        });
        
        // Validate that all pages have content (check for text, not just HTML tags)
        const validPages = this.textPages.filter(p => {
          const textContent = p.content.replace(/<[^>]*>/g, '').trim();
          return textContent.length > 0;
        });
        if (validPages.length === 0) {
          this.showErrorPopup("Please enter content for at least one page");
          return;
        }
        content = validPages;
      }
    } else if (this.itemType === "image") {
      if (!this.imageBase64 && !this.imagePreview) {
        this.showErrorPopup("Please upload an image");
        return;
      }
      content = this.imageBase64 || this.imagePreview || "";
    } else if (this.itemType === "url") {
      if (!this.urlContent.trim()) {
        this.showErrorPopup("Please enter a URL");
        return;
      }
      content = this.urlContent.trim();
    } else {
      content = "";
    }

    const itemData: Partial<LibraryItem & { pageGuids?: number[]; tagGuids?: number[] }> = {
      name: this.itemName.trim(),
      type: this.itemType,
      content: content,
      description: this.itemDescription.trim() || undefined,
      background_color: this.backgroundColor.trim() || undefined,
      font_color: this.fontColor.trim() || undefined,
      author: this.itemAuthor.trim() || undefined
    };

    // Add pageGuids for text items using new page system
    if (this.itemType === "text" && this.pageReferences.length > 0) {
      // Sort pageReferences by orderNumber to ensure correct order when saving
      const sortedPageReferences = [...this.pageReferences].sort((a, b) => a.orderNumber - b.orderNumber);
      
      // Handle temporal pages - create them in database first
      const pageGuids: Array<{ guid: number; orderNumber: number }> = [];
      const temporalPagesWithOrder: Array<{ page: Page; orderNumber: number }> = [];
      
      // Separate temporal and saved pages, preserving order numbers
      sortedPageReferences.forEach(ref => {
        if (typeof ref.pageGuid === 'number' && ref.pageGuid < 0) {
          // Temporal page - needs to be created, preserve order number
          if (ref.page) {
            temporalPagesWithOrder.push({ page: ref.page, orderNumber: ref.orderNumber });
          }
        } else if (typeof ref.pageGuid === 'number') {
          // Already saved page, preserve order number
          pageGuids.push({ guid: ref.pageGuid, orderNumber: ref.orderNumber });
        }
      });
      
      // Create temporal pages in parallel
      if (temporalPagesWithOrder.length > 0) {
        const createObservables = temporalPagesWithOrder.map(({ page }) => 
          this.pagesService.createPage(page.content)
        );
        
        forkJoin(createObservables).subscribe({
          next: (newPages) => {
            // Add new page GUIDs with their order numbers
            newPages.forEach((newPage, index) => {
              if (typeof newPage.guid === 'number') {
                pageGuids.push({ 
                  guid: newPage.guid, 
                  orderNumber: temporalPagesWithOrder[index].orderNumber 
                });
              }
            });
            
            // Sort all pageGuids by orderNumber to ensure correct final order
            pageGuids.sort((a, b) => a.orderNumber - b.orderNumber);
            
            // Extract just the GUIDs in the correct order
            itemData.pageGuids = pageGuids.map(p => p.guid);
            this.proceedWithSave(itemData);
          },
          error: (error) => {
            console.error("Error creating temporal pages:", error);
            this.showErrorPopup("Error creating pages. Please try again.");
          }
        });
        return; // Exit early, will continue in callback
      } else {
        // No temporal pages, just extract GUIDs in correct order
        itemData.pageGuids = pageGuids.sort((a, b) => a.orderNumber - b.orderNumber).map(p => p.guid);
      }
    }
    
    // Sync selectedTagGuids from selectedTags (PrimeNG MultiSelect)
    if (this.selectedTags && this.selectedTags.length > 0) {
      this.selectedTagGuids = this.selectedTags.map(tag => tag.guid);
      itemData.tagGuids = this.selectedTagGuids;
    } else {
      this.selectedTagGuids = [];
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
      const updatedItem: LibraryItem & { pageGuids?: number[]; tagGuids?: number[] } = {
        ...this.editingItem,
        ...itemData
      };
      
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
    this.confirmDialogTitle = "Delete Library Item";
    this.confirmDialogMessage = `Are you sure you want to delete library item "${this.editingItem.name}"? This action cannot be undone.`;
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
          this.showErrorPopup(`Cannot delete library item "${itemName}". It is used in the following playlist(s): ${playlistNames}`);
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
