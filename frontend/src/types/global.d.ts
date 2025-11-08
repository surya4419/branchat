/// <reference types="react" />
/// <reference types="react-dom" />

declare module 'react' {
  export * from 'react';
}

declare module 'react-dom' {
  export * from 'react-dom';
}

declare module 'lucide-react' {
  export * from 'lucide-react';
}

// Global JSX namespace
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};