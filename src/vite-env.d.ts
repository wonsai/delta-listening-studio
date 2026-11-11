/// <reference types="vite/client" />

declare module '*.hwpx?url' {
  const src: string;
  export default src;
}

declare module '*.hwpx' {
  const src: string;
  export default src;
}
