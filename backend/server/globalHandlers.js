// backend/server/globalHandlers.js
// Registers global process handlers for errors and exit events

export function registerGlobalHandlers({ onExit } = {}) {
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
  });

  if (typeof onExit === 'function') {
    process.on('exit', async (code) => {
      try {
        await onExit(code);
      } catch (e) {
        console.error('Error in onExit handler:', e);
      }
    });
  }
}
