import type { metadataDB, playlistDB, syncedLyricsObj } from "../Database/DatabaseInterfaces"

/**
 * Information that can be used from the pop-up players to update their information
 */
export interface UpdateContentProps {
    title?: string,
    albumName?: string,
    author?: string
    albumArt?: Blob,
    currentTime?: number,
    duration?: number,
    audioPlaying?: boolean,
    newAudioInstance?: boolean,
    isPaused?: boolean,
    lyrics?: string | syncedLyricsObj[] | null
}

export interface PlaylistContainer {
    id: string,
    data: playlistDB
}

/**
 * Extension of the MetadataSource object with another ID, used so that Svelte doesn't trigger an error if the user adds more than one time the same element to the queue
 */
export interface MetadataSourceQueue extends MetadataSource {
    queueId: string
}

export interface MetadataSource {
    trackId: string,
    metadata: metadataDB,
}

/**
  * Extension of the MetadataSource object with another ID, used so that Svelte doesn't trigger an error if the user adds more than one time the same element to the playlist
 */
export interface MetadataSourcePlaylist extends MetadataSource {
    playlistId: string
}

/**
 * Information used to show the album/artist/etc list. This is usually passed between the component that shows all the albums/artists/etc, the main App component and the metadata viewer component
 */
export interface InfoProps {
    metadata: MetadataSource[],
    type: FilterType,
    albumArt?: Blob | string,
    albumArtImg?: HTMLImageElement,
    skipHistoryURL?: boolean,
    playlistObject?: PlaylistContainer[],
    playlistId?: string,
  }

  /**
   * From which section of the application this component has been called. For example, if it has been called from the "Artists" view, the "Album" view and so on
   */
  export type FilterType = "album" | "artist" | "albumArtist" | "playlist";
  /**
   * How the `[string, MetadataSource[]][]` object is divided
   */
export type PossibleSortingOptions = "album" | "authors" | "albumauthors" | "none";