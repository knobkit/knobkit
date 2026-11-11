// vite's `?worker` suffix: the default export constructs the worker, built and served by the app's
// own bundle. (Declared here rather than through `vite/client`, which would add every vite ambient.)
declare module "pdfjs-dist/build/pdf.worker.min.mjs?worker" {
  const PdfWorker: new () => Worker;
  export default PdfWorker;
}
