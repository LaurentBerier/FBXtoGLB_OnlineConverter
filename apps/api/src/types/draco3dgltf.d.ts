declare module 'draco3dgltf' {
  // gltf-transform only needs the opaque encoder/decoder module instances.
  export function createEncoderModule(options?: unknown): Promise<unknown>;
  export function createDecoderModule(options?: unknown): Promise<unknown>;
  const _default: {
    createEncoderModule: typeof createEncoderModule;
    createDecoderModule: typeof createDecoderModule;
  };
  export default _default;
}
