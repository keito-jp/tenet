import { RouterContext } from "next/dist/next-server/lib/router-context"; // next < 11.2

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  nextRouter: {
    Provider: RouterContext.Provider,
    push() {}, // override with an empty function.
  },
}