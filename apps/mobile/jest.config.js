module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  transform: {
    "^.+\\.[jt]sx?$": ["babel-jest", { presets: ["babel-preset-expo"] }],
  },
};
