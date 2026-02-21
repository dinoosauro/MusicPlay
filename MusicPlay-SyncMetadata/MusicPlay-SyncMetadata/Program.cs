using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.JSInterop;
using MusicPlay_SyncMetadata;
using static MusicPlay_SyncMetadata.App;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
var host = builder.Build();
var jsRuntime = host.Services.GetRequiredService<IJSRuntime>();
JsInteropHelper.Initialize(jsRuntime);
await host.RunAsync();

