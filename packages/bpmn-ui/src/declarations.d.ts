// Allow side-effect CSS imports (consumed at build time by the host Next.js app).
declare module "*.css" {
  const _: string;
  export default _;
}
