const obj = {
    /**
     * The iFrame element used to load Blazor WebAssembly for adding metadata to songs
     */
    iFrame: Object.assign(document.createElement("iframe"), {style: "opacity: 0; width: 1px; height: 1px;"}),
    /**
     * If Blazor WebAssembly has been successfully opened
     */
    isiFrameReady: false,
    /**
     * URL to use as the source of the iFrame
     */
    iFrameSrc: window.location.hostname.startsWith("localhost") ? "http://localhost:5071/" : "./metadata-merger/" 
}

export default obj;