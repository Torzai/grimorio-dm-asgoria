import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no layout, so scrolling does nothing; it only logs "Not implemented".
// Absent in the tests that run in the node environment.
if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
}

afterEach(() => {
  cleanup();
});
