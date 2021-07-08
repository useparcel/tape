import "regenerator-runtime/runtime";

import { tape } from "../packages/tape";
import { sass } from "../packages/plugin-sass";
import { cssInline } from "../packages/plugin-css-inline";
import { htmlMinify } from "../packages/plugin-html-minify";
import { htmlPrettify } from "../packages/plugin-html-prettify";

const mimeType = {
  ".css": "text/css",
  ".html": "text/html",
};

const urlWrite = (config) => {
  return {
    name: "url-write",
    write({ asset }) {
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

      config.cache.push(objectURL);

      return objectURL;
    },
  };
};

const iframe = document.querySelector("iframe");
const errorOverlay = document.querySelector("#error");
let baseFiles = {};
[...document.querySelectorAll(".editor")].forEach((editor) => {
  baseFiles[editor.getAttribute("data-file")] = {
    content: editor.querySelector("textarea").value,
  };
});

const cacheConfig = { cache: [] };

async function compile(update) {
  baseFiles = {
    ...baseFiles,
    ...update,
  };

  for (let url of cacheConfig.cache) {
    URL.revokeObjectURL(url);
  }

  try {
    const { files, entry } = await tape({
      entry: "/index.html",
      plugins: [sass, cssInline, htmlMinify, [urlWrite, cacheConfig]],
      files: baseFiles,
    });

    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(files[entry].content);
    iframe.contentWindow.document.close();
    error.innerHTML = "";
  } catch (error) {
    errorOverlay.innerHTML = `
        <html>
        <body style="">
          <div style="margin: 0; font-family: system-ui; color: #730f45;box-sizing: border-box;background: #fce4ec; padding: 20px; height: 250px; width: 100%; display: flex; justify-content: space-between; align-items: center;">
            <div>
            <h1 style=" font-size: 20px;">Error: ${error.message}</h1>
            <pre style="width: 100%; white-space: break-spaces;">${
              error.stack
            }</pre>
            ${
              error.hasOwnProperty("path")
                ? `
              <code>File: ${error.path}</code><br/>
              <code>Line: ${error.line}</code><br/>
              <code>Column: ${error.column}</code><br/>
            `
                : ""
            }
            </div>
          </div>
        </body>
        </html>
      `;
  }
}

[...document.querySelectorAll("textarea")].forEach((textarea) => {
  textarea.addEventListener("input", () => {
    const file = textarea.parentElement.getAttribute("data-file");
    compile({
      [file]: {
        content: textarea.value,
      },
    });
  });
});
