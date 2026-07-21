<script lang="ts">
  import AudioPlayer from "./lib/AudioPlayer/PopupAudioPlayer.svelte";
  import Card from "./lib/Card.svelte";
  import Header from "./lib/Header.svelte";
  import Albums from "./lib/PlayerTabs/Albums.svelte";
  import AudioManager from "./ts/Player/AudioManager";
  import type { DatabaseContainer, playlistDB } from "./ts/Database/DatabaseInterfaces";
  import GetAlbumArt from "./ts/DataFetcher/GetAlbumArt";
  import IndexedDatabase from "./ts/Database/IndexedDatabase";
  import LoadMetadata from "./ts/DataFetcher/LoadMetadata";
  import {UploadSongs} from "./ts/Database/UploadSongs";
  import type { InfoProps, MetadataSource, PlaylistContainer, PossibleSortingOptions } from "./ts/Player/PlayerInterfaces";
  import AlbumViewer from "./lib/AlbumViewer.svelte";
  import AnimationHandler from "./ts/Animations/ImageAnimationHandler";
  import { mount, onMount, unmount } from "svelte";
  import { fullscreenObject, mediaPlayerObject } from "./ts/Animations/CrossComponentAnimationsInfo";
  import { imageMap } from "./ts/SvelteComponentsHelpers/GlobalInformation";
  import type { OpacityChange, PopupScalingInfo } from "./ts/Animations/AnimationTypes";
  import Icons from "./ts/Icons/IconsManager";
  import DropdownMenuOpen from "./lib/DropdownMenu/DropdownMenuOpen.svelte";
  import Tracks from "./lib/PlayerTabs/Tracks.svelte";
  import Authors from "./lib/PlayerTabs/Authors.svelte";
  import ArtistImageManager from "./ts/DataFetcher/ArtistImageManager";
  import { fade, slide } from "svelte/transition";
  import { cubicInOut } from "svelte/easing";
  import HistoryHandler from "./ts/Player/HistoryHandler";
    import FullscreenAudioPlayer from "./lib/AudioPlayer/FullscreenAudioPlayer.svelte";
    import PopupPlayerAnimationHandler from "./ts/Animations/PopupPlayerAnimationHandler";
    import RefreshUploadedFolders from "./ts/Database/RefreshUploadedFolders";
    import IconsSource from "./ts/Icons/IconsSource";
    import Playlists from "./lib/PlayerTabs/Playlists.svelte";
    import AutoRevokeUrl from "./ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import Settings from "./lib/Dialogs/Settings.svelte";
    import { lang } from "./ts/SvelteComponentsHelpers/Language";
    import { registerEmptySpace } from "./ts/SvelteComponentsHelpers/EmptySpace";
    import SettingProp from "./ts/Settings"
    import ReadM3UPlaylist from "./ts/Database/ReadM3UPlaylist";
    import ShowNewPlaylist from "./ts/SvelteComponentsHelpers/ShowNewPlaylist";
    import SelectHelper from "./ts/SvelteComponentsHelpers/SelectHelper";
    import DeleteFiles from "./ts/Database/DeleteFiles";
    import Dialog from "./lib/Dialog.svelte";
    import GetAllPlaylists from "./ts/DataFetcher/GetAllPlaylists";
    import CreateNewPlaylist from "./ts/Database/CreateNewPlaylist";
    import DropdownButtonShow from "./lib/DropdownMenu/DropdownButtonShow.svelte";
    import SelectedItemDropdown from "./lib/DropdownMenu/SelectedItemDropdown.svelte";
    import IconsManager from "./ts/Icons/IconsManager";
    import SelectableMusic from "./ts/SvelteComponentsHelpers/SelectableMusic";
    import Convert from "./lib/Dialogs/Convert.svelte";
  let haveSongsBeenAdded = $state(
    localStorage.getItem("MusicPlayer-ItemsAdded") === "1",
  );
  /**
   * All the databases used by the application
   */
  let databases: DatabaseContainer | undefined = $state(undefined);
  /**
   * Some information used to display the metadata of the currently-selected album/artist etc.
   */
  let selectedInformation = $state<InfoProps | undefined>();
    /**
     * Force the refresh of the entire webpage. It's currently never used.
     */
  let forceRefresh = $state(crypto.randomUUID());
  /**
   * The container of the albums/artists/playlists/etc. list section. 
   * This is saved as a variable since, to fix UI glitches on iOS, we need to change its opacity to 0 when the album viewer is opened.
   */
  let libraryViewer: HTMLDivElement;
  /**
   * The current page that is being shown (ex: all the albums, all the playlists etc).
   * Note that this property won't be updated if the user goes in the fullscreen mode, or opens the details of a single album/playlist etc.
   */
  let pageShown = $state("albumView");
  /**
   * Show the dropdown that enables the user to switch between sections
   */
  let showFilterDropdownMenu = $state(false);
  /**
   * Show the dropdown that permits to user to upload new files/folders or refresh the uploaded folders
   */
  let showMusicUploadOptions = $state(false);
  /**
   * Show the settings dialog
   */
  let showSettingsDialog = $state(false);
  /**
   * An identifier of the current back button operation, so that we can avoid firing multiple events if the user goes back multiple times before the animatinons finish
   */
  let backButtonOperationId = crypto.randomUUID();
  /**
   * The container for the pop-up audio player, added as a variable so that it cna be animated
   */
  let audioPlaybackController: HTMLDivElement;
  /**
   * If true, the Fullscreen pop-up player won't add the "#fullscreen" URL to the application history. This is usually set to true when the user is navigating forwards/backwards between sections.
   */
  let skipHistoryUrlForFullscreenView = false;
  /**
   * List of the metadata of all the songs loaded by the application, divided by a certain criteria (ex: album, etc.) that is specified in the string
   */
  let loadedMetadata = $state<[string, MetadataSource[]][] | undefined>(
    undefined,
  );
  /**
   * The image where the transition from the pop-up player to the fullscreen player will origin. If passed, the fullscreen player will be opened.
   */
  let showFullscreenPlayer = $state<HTMLImageElement | undefined>();
    /**
     * The type used to divide the `loadedMetadata` object.
     */
  let sortingType: PossibleSortingOptions = new URLSearchParams(window.location.hash.substring(1)).get("pageShown") ? getSortingType(new URLSearchParams(window.location.hash.substring(1)).get("pageShown") as "authors") : "album";
  /**
   * The number of selected items. If it's not undefined, a pop-up will be displayed in the bottom part of the webpage to let the user do some action with the selected tracks.
   */
  let showSelectedItemsCallback = $state<number | undefined>(undefined);
  /**
    * If not undefined, the playlist container array that the Playlist component is using to display all the playlist.
    * Passed so that it's possible to create a new playlist from a selection of song tracks, and to display it in the Playlists section without re-reading all the database. 
    */
  let playlistObjectInUse: PlaylistContainer[] | undefined;
  /**
   * If not `false`, the metadata list of all the songs that should be converted
   */
  let convertDialog = $state<MetadataSource[] | false>(false);
  /**
   * Function called when the user has selected/unselected a song track
   */
  function selectCallback() {
    SelectHelper.isSelectModeEnabled = SelectHelper.selectedItems.size !== 0; // Disable select mode if no items are selected
    if (!SelectHelper.isSelectModeEnabled) {
      showSelectedItemsCallback = undefined;
      SelectableMusic.clearAllSelected(); // Remove the gray-ish background color to all the selected items
      SelectHelper.isRangeSelectModeEnabled = false;
      return;
    }
    showSelectedItemsCallback = SelectHelper.selectedItems.size;
  }
    /**
     * Get the sorting type for the `LoadMetadata` function
     * @param id the `pageShown` identifier
     */
    function getSortingType(id: string) {
      return id === "trackView" ? "none" : id === "artistsView" ? "authors" : id === "albumArtistsView" ? "albumauthors" : "album";
    }

  onMount(async () => {
    // Load all the databases
    databases = {
      songDb: await IndexedDatabase.db("contentData"),
      albumArtDb: await IndexedDatabase.db("albumArt"),
      metadataDb: await IndexedDatabase.db("musicMetadata"),
      artistImgDb: await IndexedDatabase.db("artistImg"),
      directoryHandleDb: await IndexedDatabase.db("folderHandle"),
      playlistDb: await IndexedDatabase.db("playlist"),
      playlistImgDb: await IndexedDatabase.db("playlistImg"),
      songStatsDb: await IndexedDatabase.db("songStats")
    };
    const params = new URLSearchParams(window.location.hash.substring(1));
    const id = params.get("pageShown");
    loadedMetadata = await LoadMetadata(databases, getSortingType(id || "albumView"));
    navigator.storage && navigator.storage.persist && navigator.storage.persist();
    if (id === "albumView" || id === "trackView" || id === "artistsView" || id === "albumArtistsView" || id === "playlistsView") pageShown = id;
    haveSongsBeenAdded = true; // Since, if there are no entries, the length of loadedMetadata will be 0
    AudioManager.updateSongDb(databases.songDb, databases.albumArtDb, databases.songStatsDb, databases.metadataDb); // Update the databases used by the AudioManager
    history.scrollRestoration = "manual"; // Avoid that the browser restores the scroll position when going forwards or backwards the webpage.
    /**
     * The X position of the touch start. This value is used to handle the back gesture
     */
    let startX = -1;
    document.addEventListener("keyup", (e) => {
      if (e.key === "Escape") {
        history.back();
      }
    })
    // Events that handle the back button gesture.
    document.addEventListener("touchstart", (e) => {
        if (e.touches[0].clientX < (window.innerWidth * 15) / 100 && e.touches.length === 1) {
          startX = e.touches[0].clientX;
        } else startX = -1;
      }, { passive: false });
    document.addEventListener("touchend", (e) => {
      if (e.changedTouches[0].clientX - startX > (window.innerWidth * 25) / 100 && startX !== -1) { // Let's check that the user has scrolled at least 1/4 of the webpage before going back to the previous page
        e.preventDefault();
        HistoryHandler.goBack();
      }
      startX = -1;
    }, { passive: false });
    document.addEventListener("touchmove", (e) => {
      startX !== -1 && e.preventDefault();
    }, { passive: false },);

    /**
     * Make the library viewer visible. This function waits until the library viewer is appended to the DOM.
     */
    function waitForLibraryViewer() {
      if (!libraryViewer) {
        setTimeout(() => waitForLibraryViewer(), 10);
        return;
      }
      libraryViewer.style.opacity = "1";
    }
    /**
     * The function that handles back button gestures
     * @param state the state from the "popstate" event
     */
    async function backButtonCallback(state: string) {
      if (HistoryHandler.closeCommand) { // A dialog is opened. We need to close it.
        history.forward(); // We're going forward since dialogs don't create a new hash entry, so we need to keep the previous section.
        HistoryHandler.closeCommand(); // Close the dialog
        return;
      }
      const params = new URLSearchParams(window.location.hash.substring(1));
      const hash = params.get("appSection") ?? "";
      if (showFullscreenPlayer) { // Fullscreen opened
        if (hash === "lyrics" || hash === "queue") { // We need to open one of these two divs
          if (fullscreenObject.lyrics.openRightSectionOfFullscreen) fullscreenObject.lyrics.openRightSectionOfFullscreen(true, hash === "queue");
          return;
        }
        if (hash !== "fullscreen") { // Since the location hash is different both from the fullscreen one and from the divs related to fullscreen, we need to close the fullscreen.
          audioPlaybackController.style.transform = "";
          if (hash === "#" || hash === "" || hash === "start") waitForLibraryViewer(); // Make the library viewer visible again
          if (fullscreenObject.fullscreenContent.image && fullscreenObject.fullscreenContent.container) { // We can do the reverse animation from the fullscreen element to the pop-up player image
            await AnimationHandler.stopAnimation();
            PopupPlayerAnimationHandler.stopAnimation();
            await Promise.all([
              AnimationHandler.imageAnimationHandler({
                sourceImage: fullscreenObject.fullscreenContent.image,
                outputImage: showFullscreenPlayer,
                elements: [{
                  element: fullscreenObject.fullscreenContent.container,
                  opacityChange: "start",
                  output: "0"
                }, {
                  element: showFullscreenPlayer,
                  opacityChange: "end"
                }],
                imgZIndex: "15"
              }), 
              PopupPlayerAnimationHandler.disappearElement(audioPlaybackController, true)]);
          }
          skipHistoryUrlForFullscreenView = false;
          showFullscreenPlayer = undefined;
          return;
        }
      }
      switch (hash) {
        case "fullscreen": { // Go to fullscreen mode
          if (showFullscreenPlayer) { 
            fullscreenObject.lyrics.openRightSectionOfFullscreen && fullscreenObject.lyrics.openRightSectionOfFullscreen(window.innerWidth > 800);
            return;
          }
          if (fullscreenObject.goToFullscreen) {
            skipHistoryUrlForFullscreenView = true; // Since the fullscreen hash is already added to the history, we don't need to add it again
            PopupPlayerAnimationHandler.stopAnimation();
            fullscreenObject.goToFullscreen();
          }
          break;
        }
        case "lyrics":
        case "queue": { // This should never be called, since to show the lyrics and the queue section the fullscreen object `showFullscreenPlayer` must be a vaild object. However, to be sure, we'll do the same logic here
          if (fullscreenObject.lyrics.openRightSectionOfFullscreen) {
            await PopupPlayerAnimationHandler.stopAnimation();
            await AnimationHandler.stopAnimation();
            await fullscreenObject.lyrics.openRightSectionOfFullscreen(true, hash === "queue");
          }
          break;
        }
        case "metadataList": { // We need to open the metadata viewer of a single album/artist/etc. We'll do a custom animtion from the album art of the clicked item to the main album art of the metadata list.
          const operation = crypto.randomUUID();
          backButtonOperationId = operation;
          document.body.style.overflow = "hidden"; // Avoid scrolling while the animation is ongoing
          if (loadedMetadata === undefined) break;
          /**
           * The object that should be shown in the Metadata List component.
           * This is fetched from the State property: it contains the main image ID, that is formed by `Something-KEY USED TO DIVIDE THE ITEMS`. Therefore, we can just remove the first part.
           */
          const albumEntry = loadedMetadata.find((i) => i[0] === state.substring(state.indexOf("-") + 1));
          if (albumEntry) {
            const albumArt = state.startsWith("ArtistImg") || state.startsWith("PlaylistImg") // Since for artists and playlist there isn't an automatic cache of the colors used to create the fallback album art, we'll try to get the same src used in the artist/playlist list viewer. We don't need to do this for the album art part, since the color used for the fallback album art is cached.
              ? (imageMap.get(state)?.src ??
                (await ArtistImageManager.fetchImage({
                  author: state.substring(state.indexOf("-") + 1),
                  artistImageDb: state.startsWith("PlaylistImg") ? databases?.playlistImgDb as IDBDatabase : databases?.artistImgDb as IDBDatabase,
                })))
              : await GetAlbumArt({
                  db: databases?.albumArtDb as IDBDatabase,
                  id: state.substring("AArt-".length),
                });
            await AnimationHandler.stopAnimation();
            // Update information used to show the album/artist metadata viewer
            selectedInformation = {
              metadata: albumEntry[1],
              type: state.startsWith("ArtistImg") ? "artist" : state.startsWith("PlaylistImg") ? "playlist" : "album",
              albumArt: albumArt ?? undefined,
              albumArtImg: !selectedInformation
                ? imageMap.get(state)
                : undefined,
              skipHistoryURL: true,
            };
          }
          break;
        }
        default: {
          waitForLibraryViewer();
          if (selectedInformation) { // The metadata viewer component is visible, so we need to make the reverse animation (from the main album art to the one contained in the button in the artists/album viewer)
            const operation = crypto.randomUUID();
            backButtonOperationId = operation;
            document.body.style.overflow = "";

            /**
             * The destination image for the animation (so, the one contained in a button of the artists/album/playlist etc. section)
             */
            const outputImage = imageMap.get(HistoryHandler.prevImageId);
            const backButton = mediaPlayerObject.backButtonContainer?.firstChild as HTMLElement | undefined;
            let failedAnimation = false;
            if (mediaPlayerObject.image && outputImage && backButton && mediaPlayerObject.container)
              await AnimationHandler.imageAnimationHandler({
                sourceImage: mediaPlayerObject.image,
                outputImage,
                elements: [
                  {
                    element: mediaPlayerObject.image,
                    opacityChange: "end",
                    output: "0",
                  },
                  ...Array.from(
                    mediaPlayerObject.container.querySelectorAll(".opacity"),
                  ).map((i) => {
                    return {
                      element: i as HTMLElement,
                      opacityChange: "start",
                      output: "0",
                    } as OpacityChange;
                  }),
                  {
                    element: outputImage,
                    opacityChange: "end",
                    output: "1",
                  },
                  {
                    element: backButton,
                    opacityChange: "start",
                    output: "0",
                  },
                ],
              }); else failedAnimation = true;
            if (HistoryHandler.backContext.delete && loadedMetadata) { // The back operation has been done automatically by the application since the last element of an entry has been either removed or moved. We'll make an opacity transition, and later delete it.
              HistoryHandler.backContext.delete = false;
              if (!selectedInformation.playlistObject) { // The item deleted is not a playlist, so we need to splice the `loadedMetadata` object
                const mainBtn = outputImage?.closest("button");
                if (mainBtn) { // Opacity animation before removing it
                  mainBtn.style.opacity = "0";
                  await new Promise<void>(res => mainBtn.animate([{opacity: "1"},{opacity: "0"}], {duration: 400, easing: "ease-in-out"}).addEventListener("finish", () => res()));
                }
                // Let's now delete the empty entry from the list. Svelte will delete it also from the DOM.
                const index = loadedMetadata.findIndex((i) => i[0] === HistoryHandler.prevImageId.substring(HistoryHandler.prevImageId.indexOf("-") + 1)); 
                if (index !== -1) loadedMetadata.splice(index, 1);
                if (databases) IndexedDatabase.remove({db: selectedInformation.type === "albumArtist" || selectedInformation.type === "artist" ? databases.artistImgDb : databases.albumArtDb, query: HistoryHandler.prevImageId, request: selectedInformation.type === "albumArtist" || selectedInformation.type === "artist" ? "artistImg" : "albumArt" });
              } else if (HistoryHandler.backContext.deletePlaylist) { // The item to delete is a playlist, and we have the function that'll delete it from the Playlists section. This is important since the Playlists object isn't stored in the main App component, since the user might never use it (and therefore it's useless to load it and to keep it always in memory). Since the playlist object used by the Playlists component is isolated, we'll need to call a function exposed from that component to delete it from the DOM, while here in the App section we can delete the playlist entry.
                  for (let i = 0; i < selectedInformation.playlistObject.length; i++) {
                    const item = selectedInformation.playlistObject[i];
                    if (item.data.contents.length === 0) {
                    const mainBtn = imageMap.get(`PlaylistImg-${item.id}`)?.closest("button");
                    if (mainBtn) {
                      mainBtn.style.opacity = "0";
                      await new Promise<void>(res => mainBtn.animate([{opacity: "1"},{opacity: "0"}], {duration: 400, easing: "ease-in-out"}).addEventListener("finish", () => res()));
                    }
                    HistoryHandler.backContext.deletePlaylist(item.id);
                      if (databases) {
                        await IndexedDatabase.remove({
                            db: databases.playlistImgDb,
                            query: item.id,
                            request: "playlistImg"
                        });
                        await IndexedDatabase.remove({
                            db: databases.playlistDb,
                            query: item.id,
                            request: "playlist"
                        });
                      }
                      i--;
                    }
                  }
                }
            } 
            if (backButtonOperationId === operation) selectedInformation = undefined; // Remove the metadata list viewer from the DOM
          }
          break;
        }
      }
    }
    window.addEventListener("popstate", async (event) => { // The user has gone backwards-forwards to the webpage
      function checkDatabases() {
        if (!databases) {
          setTimeout(() => checkDatabases(), 200);
          return;
        }
        backButtonCallback(event.state);
      }
      checkDatabases();
    });
  });
</script>

{#key forceRefresh}
  <main>
    {#if showSettingsDialog}
      <Settings {databases} closeCallback={() => (showSettingsDialog = false)}></Settings>
    {/if}
    {#if databases}
    {#if showFilterDropdownMenu || showMusicUploadOptions}
      <button class="emptyButton maxWidth maxHeight" style="position: fixed; top: 0; left: 0; z-index: 6" title={lang("Close the dropdown list")} onclick={() => { // Close the dialog if the user clicks elsewhere
        showFilterDropdownMenu = false;
        showMusicUploadOptions = false;
      }}></button>
    {/if}
    <div
      class="circularButton emptyButton multiCircularButton"
      style={`position: fixed; right: calc(15px + env(safe-area-inset-right)); top: calc(15px + env(safe-area-inset-top))${showFilterDropdownMenu || showMusicUploadOptions ? "; flex-direction: column; padding: 10px;" : ""}; max-width: calc(100vw - 55px); max-height: calc(100vh - 55px); z-index: 7`}
    >
      {#if !showFilterDropdownMenu && !showMusicUploadOptions}
        <div
          class="flex hcenter gap"
          in:slide={{ duration: 200, axis: "x", easing: cubicInOut }}
        >
          <button
            class="emptyButton flex hcenter wcenter"
            style="display: flex;"
            title={lang("Upload new songs")}
            onclick={() => {
              showMusicUploadOptions = true;
            }}
          >
            <img
              src={Icons.getIconObjectUrl("upload")}
              class="icon"
              use:AutoRevokeUrl
              alt={lang("Upload new songs")}
            />
          </button>
          {#if !selectedInformation || selectedInformation.playlistId}
          <button
            class="emptyButton flex hcenter wcenter"
            style="display: flex;"
            onclick={() => (showFilterDropdownMenu = true)}
            title={lang("Change view")}
          >
            <img
              src={Icons.getIconObjectUrl("filter")}
              class="icon"
              use:AutoRevokeUrl
              alt={lang("Change view")}
            />
          </button>
          {/if}
          {#if selectedInformation}
          <button class="emptyButton flex hcenter wcenter" style="display: flex;" title={lang("Select all")} onclick={() => {
            // This button allows to select all the songs in the current webpage. If every song is selected, all the songs in the webpage will be deselected.
            SelectHelper.isSelectModeEnabled = true;
            /**
             * If true, all the songs have been selected
             */
            const areAllSelected = Array.from(SelectableMusic.list.values()).every(i => i.style.backgroundColor === "var(--cardtransparent)");
            for (const [key, val] of SelectableMusic.list) {
              if (!key.startsWith("Track-") && (val.style.backgroundColor !== "var(--cardtransparent)" || areAllSelected)) val.click(); // With `!key.startsWith("Track-")` we skip changing the color of all the songs that have been selected from the single track view.
            }
          }}>
            <img src={Icons.getIconObjectUrl("selectall")} class="icon" use:AutoRevokeUrl alt={lang("Select all")}>
          </button>
          {/if}
                    <button
            class="emptyButton flex hcenter wcenter"
            style="display: flex;"
            title={lang("Application settings")}
            onclick={() => (showSettingsDialog = true)}
          >
            <img
              src={Icons.getIconObjectUrl("settings")}
              class="icon"
              use:AutoRevokeUrl
              alt={lang("Application settings")}
            />
          </button>
        </div>
      {:else if showFilterDropdownMenu && !selectedInformation?.playlistId}
        <div>
          <DropdownMenuOpen
            callback={async (id) => {
              if (id === "reverse") {
                loadedMetadata?.reverse();
                showFilterDropdownMenu = false;
              }
              if (id === "albumView" || id === "trackView" || id === "artistsView" || id === "albumArtistsView" || id === "playlistsView") {
                showFilterDropdownMenu = false;
                if (databases) {
                  sortingType = getSortingType(id);
                  loadedMetadata = await LoadMetadata(databases, sortingType);
                }
                pageShown = id;
                // Update the history URL with the new page 
                const params = new URLSearchParams(window.location.hash.substring(1));
                params.set("pageShown", id);
                params.delete("openedResource");
                history.pushState(history.state, "", `./#${params.toString()}`);
              }
            }}
            options={[
              {
                categoryInfo: {
                  icon: "filter",
                  text: lang("Change library view mode"),
                  id: "changeLibView",
                },
                categoryItems: [
                  { icon: "cd", text: lang("Album view"), id: "albumView" },
                  { icon: "songNote", text: lang("Track view"), id: "trackView" },
                  {
                    icon: "people",
                    text: lang("Artists view"),
                    id: "artistsView",
                  },
                  {
                    icon: "person",
                    text: lang("Album artists view"),
                    id: "albumArtistsView",
                  },
                  {icon: "heart", text: lang("Playlists view"), id: "playlistsView"},
                ],
              },
              {
                categoryInfo: {icon: "arrowsort", text: lang("Reverse order"), id: "reverse"},
                categoryItems: []
              }
            ]}
          ></DropdownMenuOpen>
        </div>
      {:else if showFilterDropdownMenu}
      <div>
        <DropdownMenuOpen callback={(id) => {
          showFilterDropdownMenu = false;
          mediaPlayerObject.sortPlaylist && mediaPlayerObject.sortPlaylist(id)
          }} options={[{
          categoryInfo: {
            id: "sortByMain",
            text: lang("Sort by"),
            icon: "filter"
          },
          categoryItems: [{
            id: "sortAlbum",
            text: lang("Album name"),
            icon: "cd"
          }, {
            id: "sortArtist",
            text: lang("Artists name"),
            icon: "people"
          }, {
            id: "sortAlbumArtist",
            text: lang("Album artists name"),
            icon: "person"
          }, {
            id: "sortTitle",
            text: lang("Title name"),
            icon: "list"
          }, {
            id: "sortCustom",
            text: lang("Custom order"),
            icon: "pin"
          }]
        }, {
          categoryInfo: {
            text: lang("Reverse order"),
            id: "sortReverse",
            icon: "arrowsort"
          },
          categoryItems: []
        }]}></DropdownMenuOpen>
      </div>
      {:else}
        <div>
          <DropdownMenuOpen 
          callback={(id) => {
            if (typeof loadedMetadata === "undefined") loadedMetadata = [];
            switch(id) {
              case "loadFile":
                databases && UploadSongs({
                  database: databases,
                  metadataToUpdate: {
                    type: sortingType,
                    data: loadedMetadata
                  }
                });
                showMusicUploadOptions = false;
                break;
              case "loadFolder":
                if (typeof loadedMetadata === "undefined") loadedMetadata = [];
                databases && UploadSongs({
                  database: databases,
                  metadataToUpdate: {
                    type: sortingType,
                    data: loadedMetadata
                  },
                  pickFolder: true
                });
                showMusicUploadOptions = false;
                break;
              case "RefreshFolder":
                if (typeof loadedMetadata === "undefined") loadedMetadata = [];
                databases && RefreshUploadedFolders({
                  database: databases,
                  alreadyAddedMetadata: loadedMetadata ?? [],
                  sortingType
                });
                showMusicUploadOptions = false;
                break;
              case "importPlaylist": {
                const input = Object.assign(document.createElement("input"), {
                  type: "file",
                  multiple: true,
                  onchange: async () => {
                    /**
                     * If true, at least one playlist has been imported. Therefore, the website will show an alert notifying the user that the playlist has been imported.
                     */
                    let successful = false;
                    if (input.files) {
                      if (!loadedMetadata || !databases) return;
                      for (const file of input.files) {
                        if (!file.name.endsWith("m3u8") && !file.name.endsWith("m3u")) continue;
                        const id = crypto.randomUUID(); // New ID for the playlist
                        const playlistObj: playlistDB = {
                          name: file.name.substring(0, file.name.lastIndexOf(".")),
                          contents: ReadM3UPlaylist({songs: loadedMetadata, m3uText: await file.text()}),
                        };
                        await IndexedDatabase.set({
                          db: databases.playlistDb,
                          request: "playlist",
                          object: {
                            id,
                            data: playlistObj
                          }
                        });
                        if (ShowNewPlaylist.showPlaylist) ShowNewPlaylist.showPlaylist({id, data: playlistObj}); // If the "Playlist" tab is open, show the new playlist there
                        successful = true;
                      }
                    }
                    alert(lang("Playlists successfully imported"))
                  }
                });
                input.click();
                showMusicUploadOptions = false;
                break;
              }
            }
          }}
          options={[{
            categoryInfo: {
              id: "LoadFileMain",
              text: lang("Upload new files or folders"),
              icon: "upload"
            },
            categoryItems: [{
              id: "loadFile",
              text: lang("Upload new files"),
              icon: "document"
            }, {
              id: "loadFolder",
              text: lang("Upload a new folder"),
              icon: "folder"
            }]
          }, {
            categoryInfo: {
              id: "importPlaylist",
              text: lang("Import playlist"),
              icon: "heart"
            },
            categoryItems: []
          }, ...(localStorage.getItem("MusicPlayer-FSApiUsed") === "1" ? [{
            categoryInfo: {
              id: "RefreshFolder",
              text: lang("Refresh already uploaded folders"),
              icon: "arrowsync" as keyof typeof IconsSource
            },
            categoryItems: []
          }] :[])]}></DropdownMenuOpen>
        </div>
      {/if}
    </div>
      {#if !haveSongsBeenAdded || loadedMetadata?.length === 0}
        <Header></Header><br />
        <Card>
          <h2>{lang("Your library is empty")}</h2>
          <p>{lang("Upload some files with the Upload button at the top-right of the screen")}.</p>
        </Card>
      {:else}
        <div
          class="bottomPlayerContainer opacity"
          style="opacity: 1;"
          bind:this={audioPlaybackController}
        >
          <AudioPlayer metadataDb={databases.metadataDb} albumArtDb={databases.albumArtDb} fullscreenCallback={(img) => {
            showFullscreenPlayer = img;
            PopupPlayerAnimationHandler.disappearElement(audioPlaybackController);
          }}></AudioPlayer>
        </div>
        {#if typeof showSelectedItemsCallback === "number"}
          <div class="bottomPlayerContainer opacity" style="opacity: 1; z-index: 10" in:fade={{easing: cubicInOut, duration: 200}} out:fade={{easing: cubicInOut, duration: 200}}>
          <div class="flex hcenter">            
            <p style="width: 100%">{lang("Selected items")}: {showSelectedItemsCallback}</p>
            <div style="transform: translateY(1px);">
              <button class="emptyButton flex hcenter gap" onclick={() => {
                if (!SelectHelper.isRangeSelectModeEnabled && !confirm(lang("Do you want to enable range select mode? All the songs between the previous click and the next one will be selected. Click again on the icon to deselect all the items in the range. Click again to disable this mode."))) return;
                SelectHelper.multipleTrackSelectionInformation.trackId = undefined;
                if (!SelectHelper.isRangeSelectModeEnabled) {
                  SelectHelper.isRangeSelectModeEnabled = true;
                } else if (!SelectHelper.deselectItems) {
                  SelectHelper.deselectItems = true;
                } else {
                  SelectHelper.isRangeSelectModeEnabled = false;
                  SelectHelper.deselectItems = false;
                }
              }}>
                <img use:AutoRevokeUrl alt={lang("Enable range select mode")} src={IconsManager.getIconObjectUrl("selectobject")} style="width: 21px; height: 21px;">
              </button>
            </div>
            <div style="transform: translateY(1px)">
              <button class="emptyButton flex hcenter gap" onclick={() => {
                SelectHelper.selectedItems.clear();
                selectCallback();
              }}>
              <img use:AutoRevokeUrl alt={lang("Discard selection")} src={IconsManager.getIconObjectUrl("dismiss")} style="width: 24px; height: 24px">
            </button>
            </div>
            <div>
              <DropdownButtonShow placeholderIcon="morevertical" iconAlt={lang("Options about the selected tracks")}>
                {#snippet children(scaleInfo: PopupScalingInfo)}
                    <SelectedItemDropdown convertCallback={() => {
                      if (!loadedMetadata) return;
                      // Let's build the metadata array for the convert dialog
                      const outMetadata = new Set<MetadataSource>();
                      for (const [_, metadata] of loadedMetadata) {
                        for (const item of metadata) {
                          if (SelectHelper.selectedItems.has(item.trackId)) outMetadata.add(item);
                        }
                      } 
                      convertDialog = outMetadata.size === 0 ? false : Array.from(outMetadata);
                    }} playlistPassed={playlistObjectInUse} {pageShown} animationInfo={scaleInfo} {loadedMetadata} {databases} {selectCallback}></SelectedItemDropdown>
                {/snippet}
              </DropdownButtonShow>
            </div>
          </div>
          </div>
        {/if}
        {#if convertDialog}
          <Convert closeFn={() => (convertDialog = false)} {databases} data={convertDialog}></Convert>
        {/if}
        {#if showFullscreenPlayer}
          <FullscreenAudioPlayer metadataDb={databases.metadataDb} albumArtDb={databases.albumArtDb} albumArt={`${showFullscreenPlayer.getAttribute("data-nextsrc") || showFullscreenPlayer.src}`} {skipHistoryUrlForFullscreenView} imageTransitionCallback={async (img, elements) => {
            await AnimationHandler.imageAnimationHandler({
                  sourceImage: showFullscreenPlayer as HTMLImageElement,
                  outputImage: img,
                  keepBodyOverflowHidden: true,
                  imgZIndex: "15",
                  elements,
              });
              if (new URLSearchParams(window.location.hash.substring(1)).get("appSection") === "metadataList") libraryViewer.style.opacity = "0";
          }}></FullscreenAudioPlayer>
      {/if}
        <div bind:this={libraryViewer}>
          {#key pageShown}
          {#if pageShown === "albumView"}
            <Albums
              {databases}
              updateContent={(content) => (selectedInformation = content)}
              metadata={loadedMetadata}
            ></Albums>
          {:else if pageShown === "trackView"}
            <Tracks {selectCallback} {databases} metadataObj={loadedMetadata}></Tracks>
          {:else if pageShown === "artistsView" || pageShown === "albumArtistsView"}
            <Authors
              {databases}
              metadata={loadedMetadata}
              updateContent={(content) => (selectedInformation = content)}
              isAlbumArtist={pageShown === "albumArtistsView"}
            ></Authors>
          {:else if pageShown === "playlistsView"}
          <Playlists passPlaylists={(item) => (playlistObjectInUse = item)} metadata={loadedMetadata} {databases} updateContent={(content) => (selectedInformation = content)}></Playlists>
          {/if}
          <div use:registerEmptySpace></div>
          {/key}
        </div>
        {#if selectedInformation?.type === "album" || selectedInformation?.type === "artist" || selectedInformation?.type === "albumArtist" || selectedInformation?.type === "playlist"}
          <AlbumViewer
            {selectCallback}
            {databases}
            allMetadataLoaded={loadedMetadata as [string, MetadataSource[]][]}
            songs={selectedInformation.metadata}
            {sortingType}
            albumArt={selectedInformation.albumArt}
            skipHistoryUrl={selectedInformation.skipHistoryURL}
            contentType={selectedInformation.type}
            mediaControllerDiv={audioPlaybackController}
            playlistContainer={selectedInformation.playlistObject}
            playlistId={selectedInformation.playlistId}
            stateId={selectedInformation.passedId}
            imageTransitionCallback={async (img, elements) => {
              if (selectedInformation?.albumArtImg)
                await AnimationHandler.imageAnimationHandler({
                  sourceImage: selectedInformation.albumArtImg,
                  outputImage: img,
                  keepBodyOverflowHidden: true,
                  elements,
                });
              else {
                for (const element of elements)
                  element.element.style.opacity = "1";
              }
              if (new URLSearchParams(window.location.hash.substring(1)).get("appSection") === "metadataList") libraryViewer.style.opacity = "0";
            }}
          ></AlbumViewer>
        {/if}
      {/if}
    {/if}
  </main>
  {/key}