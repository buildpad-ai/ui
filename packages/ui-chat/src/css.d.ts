// CSS module declarations
declare module '*.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Side-effect CSS imports
declare module '*.css';
