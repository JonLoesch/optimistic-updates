import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Banner, Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "./globals.css";
import { DaisyUiPatchTheme } from "../custom";

export const metadata = {
  // Define your metadata here
  // For more information on metadata API, see: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
};

const banner = <Banner storageKey="some-key">Nextra 4.0 is released 🎉</Banner>;
const navbar = (
  <Navbar
    logo={
      <div className="flex flex-row gap-4">
        <b>Optimistic Update Engine</b>
        <div className="tooltip tooltip-bottom">
          <div className="tooltip-content">
            This is an <b>early stage concept</b>. Please be aware of that before using it in any production system.
          </div>
          <span>(version 0.0.2)</span>
        </div>
      </div>
    }
    projectLink="https://github.com/JonLoesch/optimistic-updates"
    // ... Your additional navbar options
  />
);
const footer = <Footer></Footer>;

export default async function RootLayout({ children }) {
  return (
    <html
      // Not required, but good for SEO
      lang="en"
      // Required to be set
      dir="ltr"
      // Suggested by `next-themes` package https://github.com/pacocoursey/next-themes#with-app
      suppressHydrationWarning
    >
      <DaisyUiPatchTheme />
      <Head
      // ... Your additional head options
      >
        {/* Your additional tags should be passed as `children` of `<Head>` element */}
      </Head>
      <body>
        <Layout
          banner={banner}
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/JonLoesch/optimistic-updates/tree/main/docs"
          footer={footer}
          // ... Your additional layout options
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
