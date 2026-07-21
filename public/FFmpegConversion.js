// Script used to run the single-threaded version of ffmpeg.wasm 0.11.x without freezing the main thread

importScripts("./ffmpeg.min.js");

const obj = self.FFmpeg.createFFmpeg({
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',
    mainName: 'main',
});
obj.setLogger((msg) => (self.postMessage({ type: "message", content: msg.message })));
obj.setProgress((msg) => (self.postMessage({ type: "ratio", content: msg.ratio })));
self.onmessage = async (msg) => {
    const {sourceFile, commands, type, sourceName} = msg.data;
    if (type !== "startConvert") return;
    await obj.load();
    obj.FS("writeFile", sourceName, sourceFile);
    await obj.run(...commands);
    const file = new Uint8Array(obj.FS("readFile", commands[commands.length - 1]));
    obj.FS("unlink", commands[commands.length - 1]);
    obj.FS("unlink", sourceName);
    obj.exit();
    self.postMessage({type: "file", content: file}, [file.buffer]);
}