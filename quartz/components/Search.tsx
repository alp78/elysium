import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

export default (() => {
  const Search: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    return (
      <div class={classNames(displayClass, "search")}>
        <div id="pagefind-search-container"></div>
      </div>
    )
  }

  Search.css = `
    #pagefind-search-container {
      width: 100%;
      min-width: 300px;
      margin-top: 1rem;
      margin-bottom: 1rem;
    }

    /* Tokyo Night Theme Overrides for Pagefind */
    :root {
      --pagefind-ui-scale: 0.85;
      --pagefind-ui-primary: #7aa2f7;
      --pagefind-ui-text: #a9b1d6;
      --pagefind-ui-background: #13141d;
      --pagefind-ui-border: #1a1b26;
      --pagefind-ui-tag: #565f89;
      --pagefind-ui-border-width: 1px;
      --pagefind-ui-border-radius: 6px;
      --pagefind-ui-image-border-radius: 6px;
      --pagefind-ui-image-box-ratio: 3 / 2;
      --pagefind-ui-font: "Inter", sans-serif;
    }
    
    .pagefind-ui__search-input {
      background-color: #13141d !important;
      color: #a9b1d6 !important;
      border: 1px solid #1a1b26 !important;
    }
    
    .pagefind-ui__result-link {
      color: #7aa2f7 !important;
    }
    
    .pagefind-ui__result-excerpt {
      color: #a9b1d6 !important;
    }

    .pagefind-ui__drawer {
      background-color: #1a1b26 !important;
      border: 1px solid #2f334d !important;
    }
  `

  Search.afterDOMLoaded = `
    // Determine correct base path for GitHub Pages vs Localhost
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const basePath = isLocal ? '' : '/elysium';
    const pagefindDir = basePath + '/_pagefind';

    const loadPagefind = () => {
      if (document.querySelector('#pagefind-search-container')) {
        new PagefindUI({ 
          element: '#pagefind-search-container',
          showImages: false,
          showSubResults: true,
          baseUrl: basePath + '/'
        });
      }
    };

    if (typeof PagefindUI !== 'undefined') {
      loadPagefind();
    } else {
      // Dynamically load Pagefind CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = pagefindDir + '/pagefind-ui.css';
      document.head.appendChild(link);

      // Dynamically load Pagefind JS
      const script = document.createElement('script');
      script.src = pagefindDir + '/pagefind-ui.js';
      script.onload = loadPagefind;
      document.head.appendChild(script);
    }
  `

  return Search
}) satisfies QuartzComponentConstructor