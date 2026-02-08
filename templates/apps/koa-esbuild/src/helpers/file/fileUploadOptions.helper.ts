export const fileUploadOptions = () => ({
  /* storage: diskStorage({
      destination: (req: any, file: any, cb: any) => {},
      filename: (req: any, file: any, cb: any) => {}
  }), */
  /* fileFilter: (req: any, file: any, cb: any) => {
    // console.log('req: ', req);
    // console.log('file: ', file);
  }, */
  limits: {
    fieldNameSize: 255,
    fileSize: 1024 * 1024 * 2,
    // fileSize: 1024 * 2,
  },
});
