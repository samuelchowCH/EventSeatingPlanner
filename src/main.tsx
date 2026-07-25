import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Sanitize modern CSS colors (oklch, oklab, color-mix) to prevent html2canvas color-parser crashes
const sanitizeModernColors = (val: string): string => {
  if (!val) return val;
  if (!val.includes('oklch') && !val.includes('oklab') && !val.includes('color-mix')) {
    return val;
  }
  
  let result = '';
  let i = 0;
  while (i < val.length) {
    if (
      val.substring(i, i + 6) === 'oklch(' ||
      val.substring(i, i + 6) === 'oklab(' ||
      val.substring(i, i + 10) === 'color-mix('
    ) {
      // Determine the start prefix length
      const prefix = val.substring(i, i + 6) === 'color-mix(' ? 'color-mix(' : val.substring(i, i + 6);
      i += prefix.length;
      let depth = 1;
      // Match closing parenthesis accurately to avoid cutting early in nested color expressions
      while (i < val.length && depth > 0) {
        if (val[i] === '(') depth++;
        else if (val[i] === ')') depth--;
        i++;
      }
      result += 'rgba(79, 70, 229, 0.4)'; // Safe universally parsed slate-indigo fallback
    } else {
      result += val[i];
      i++;
    }
  }
  return result;
};

// Patch both CSSStyleSheet and CSSGroupingRule (since Tailwind v4 nests variables/rules in @layers / @media groups)
const patchCssomRules = (proto: any, propertyName: string) => {
  if (!proto) return;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(proto, propertyName);
    if (descriptor && descriptor.get) {
      const originalGet = descriptor.get;
      Object.defineProperty(proto, propertyName, {
        get() {
          try {
            const rules = originalGet.call(this);
            if (!rules) return rules;
            const filtered: CSSRule[] = [];
            for (let idx = 0; idx < rules.length; idx++) {
              const rule = rules[idx];
              try {
                const cssText = rule.cssText;
                if (
                  cssText.includes('oklch(') ||
                  cssText.includes('oklab(') ||
                  cssText.includes('color-mix(')
                ) {
                  continue;
                }
              } catch (innerErr) {
                // Ignore parsing errors for cross-origin or special rule sheets
              }
              filtered.push(rule);
            }
            
            // Return an array-like CSSRuleList proxy conformant to html2canvas iteration
            const proxy = {
              length: filtered.length,
              item(index: number) {
                return filtered[index] || null;
              }
            };
            for (let idx = 0; idx < filtered.length; idx++) {
              Object.defineProperty(proxy, idx, {
                value: filtered[idx],
                writable: false,
                configurable: true,
                enumerable: true
              });
            }
            return proxy as any as CSSRuleList;
          } catch (err) {
            return originalGet.call(this);
          }
        },
        configurable: true,
        enumerable: true
      });
    }
  } catch (e) {
    console.warn(`Could not install CSSOM rule hook for ${propertyName}`, e);
  }
};

patchCssomRules(CSSStyleSheet.prototype, 'cssRules');
patchCssomRules(CSSStyleSheet.prototype, 'rules');
if (typeof CSSGroupingRule !== 'undefined') {
  patchCssomRules(CSSGroupingRule.prototype, 'cssRules');
  patchCssomRules(CSSGroupingRule.prototype, 'rules');
}

// Intercept window.getComputedStyle to translate elements' oklch/oklab styles on-demand
try {
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (element, pseudoElement) {
    const style = originalGetComputedStyle.call(this, element, pseudoElement);
    if (!style) return style;

    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function(propertyName: string) {
            const rawVal = target.getPropertyValue(propertyName);
            return sanitizeModernColors(rawVal);
          };
        }
        const val = target[prop as any];
        // Ensure standard methods remain bound to prevent "Illegal invocation" errors
        if (typeof val === 'function') {
          return val.bind(target);
        }
        if (typeof val === 'string') {
          return sanitizeModernColors(val);
        }
        return val;
      }
    });
  };
} catch (e) {
  console.warn("Could not patch window.getComputedStyle", e);
}

// Silence browser and console parsing errors originating from html2canvas deep inside logging
const patchConsole = (original: (...args: any[]) => void) => {
  return function (...args: any[]) {
    if (
      args[0] &&
      typeof args[0] === 'string' &&
      (args[0].includes('Attempting to parse an unsupported color function') ||
       args[0].includes('unsupported color function'))
    ) {
      return;
    }
    original.apply(console, args);
  };
};
console.error = patchConsole(console.error);
console.warn = patchConsole(console.warn);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


