// Firebase v9+ module type shims for TypeScript compatibility.
// These are needed when moduleResolution is set to "bundler" in tsconfig.json,
// as some TypeScript LSP versions may not resolve firebase's own .d.ts files correctly.
// This does NOT override or weaken firebase's actual types — it just ensures the module
// is recognized by TypeScript path resolution.

declare module 'firebase/app' {
    // Re-export everything from the actual firebase types (pass-through shim)
    export * from '@firebase/app';
}

declare module 'firebase/auth' {
    // Re-export everything from the actual firebase auth types (pass-through shim)
    export * from '@firebase/auth';
}

declare module 'firebase/firestore' {
    export * from '@firebase/firestore';
}

declare module 'firebase/storage' {
    export * from '@firebase/storage';
}

declare module 'firebase/messaging' {
    export * from '@firebase/messaging';
}
