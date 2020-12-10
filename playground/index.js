import "regenerator-runtime/runtime";

import Tape from "../packages/tape";
import tapeSassPlugin from "../packages/plugin-sass";
import tapeCSSInlinePlugin from "../packages/plugin-css-inline";
import tapeHTMLMinifyPlugin from "../packages/plugin-html-minify";
import tapeHTMLPrettifyPlugin from "../packages/plugin-html-prettify";

const mimeType = {
  ".css": "text/css",
  ".html": "text/html",
};

const urlWrite = () => ({
  name: "url-write",
  write({ asset, cache }) {
    if (asset.isEntry) {
      return `${asset.source.path.replace(
        new RegExp(`${asset.source.ext}$`),
        asset.ext
      )}`;
    }

    const objectURL = URL.createObjectURL(
      new Blob([asset.content], {
        type: mimeType[asset.ext],
      })
    );

    cache.set(asset.id, objectURL);
    return objectURL;
  },
  onChange({ asset, cache }) {
    const objectURL = cache.get(asset.id);

    if (objectURL) {
      cache.delete(asset.id);
      URL.revokeObjectURL(objectURL);
    }
  },
});

const iframe = document.querySelector("iframe");
const error = document.querySelector("#error");
const baseFiles = {};
[...document.querySelectorAll(".editor")].forEach((editor) => {
  baseFiles[editor.getAttribute("data-file")] = {
    content: editor.querySelector("textarea").value,
  };
});
const tape = new Tape({
  entry: "/index.html",
  plugins: [
    tapeSassPlugin,
    tapeCSSInlinePlugin,
    tapeHTMLMinifyPlugin,
    // tapeHTMLPrettifyPlugin,
    urlWrite,
  ],
  files: baseFiles,
});

// setTimeout(() => {
//   tape.update({
//     plugins: []
//   })
//   alert('changed plugins')
// }, 5000)

const manager = tape.dev();
manager.on("*", (event, data) => {
  if (event === "end") {
    console.log(data.files[data.entry].content);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(data.files[data.entry].content);
    iframe.contentWindow.document.close();
    error.innerHTML = "";
  }

  if (event === "error") {
    console.log(data.error);
    error.innerHTML = `
      <html>
      <body style="">
        <div style="margin: 0; font-family: system-ui; color: #730f45;box-sizing: border-box;background: #fce4ec; padding: 20px; height: 250px; width: 100%; display: flex; justify-content: space-between; align-items: center;">
          <div>
          <h1 style=" font-size: 20px;">Error: ${data.error.message}</h1>
          <pre style="width: 100%; white-space: break-spaces;">${
            data.error.stack
          }</pre>
          ${
            data.error.hasOwnProperty("path")
              ? `
            <code>File: ${data.error.path}</code><br/>
            <code>Line: ${data.error.line}</code><br/>
            <code>Column: ${data.error.column}</code><br/>
          `
              : ""
          }
          </div>
        </div>
      </body>
      </html>
    `;
  }
});

[...document.querySelectorAll("textarea")].forEach((textarea) => {
  textarea.addEventListener("input", () => {
    const file = textarea.parentElement.getAttribute("data-file");
    tape.update({
      files: {
        [file]: {
          content: textarea.value,
        },
      },
    });
  });
});
