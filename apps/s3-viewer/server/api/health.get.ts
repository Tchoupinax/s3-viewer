export default defineEventHandler(() => {
  return {
    status: "OK",
    timestamp: new Date().toISOString(),
  };
});
