import { forwardRef, createContext, useContext, useEffect, useState, useMemo } from "react";
import type { LayoutProps, SiderProps } from "./interface";
import styles from "./Layout.module.css";

// ---- Context ----

interface LayoutContextValue {
  hasSider: boolean;
  addSider: () => void;
  removeSider: () => void;
}

const LayoutContext = createContext<LayoutContextValue>({
  hasSider: false,
  addSider: () => {},
  removeSider: () => {},
});

// ---- Helpers ----

function clsx(...args: (string | false | null | undefined | Record<string, boolean>)[]) {
  return args
    .flatMap((a) => {
      if (!a || typeof a === "boolean") return [];
      if (typeof a === "string") return [a];
      return Object.entries(a).filter(([, v]) => v).map(([k]) => k);
    })
    .join(" ");
}

// ---- Header ----

export const Header = forwardRef<HTMLElement, LayoutProps>((props, ref) => {
  const { className, style, children, ...rest } = props;
  return (
    <header ref={ref} className={clsx(styles.header, className)} style={style} {...rest}>
      {children}
    </header>
  );
});

Header.displayName = "Header";

// ---- Footer ----

export const Footer = forwardRef<HTMLElement, LayoutProps>((props, ref) => {
  const { className, style, children, ...rest } = props;
  return (
    <footer ref={ref} className={clsx(styles.footer, className)} style={style} {...rest}>
      {children}
    </footer>
  );
});

Footer.displayName = "Footer";

// ---- Content ----

export const Content = forwardRef<HTMLElement, LayoutProps>((props, ref) => {
  const { className, style, children, ...rest } = props;
  return (
    <main ref={ref} className={clsx(styles.content, className)} style={style} {...rest}>
      {children}
    </main>
  );
});

Content.displayName = "Content";

// ---- Layout ----

const InternalLayout = forwardRef<HTMLDivElement, LayoutProps>((props, ref) => {
  const { className, style, children, hasSider: hasSiderProp, ...rest } = props;

  const [siderCount, setSiderCount] = useState(0);
  const hasSider = hasSiderProp ?? siderCount > 0;

  const ctx = useMemo(
    () => ({
      hasSider,
      addSider: () => setSiderCount((c) => c + 1),
      removeSider: () => setSiderCount((c) => c - 1),
    }),
    [hasSider],
  );

  return (
    <LayoutContext.Provider value={ctx}>
      <div
        ref={ref}
        className={clsx(styles.layout, hasSider && styles.layoutHasSider, className)}
        style={style}
        {...rest}
      >
        {children}
      </div>
    </LayoutContext.Provider>
  );
});

InternalLayout.displayName = "Layout";

// ---- Sider ----

const isNumeric = (val: unknown) =>
  !Number.isNaN(Number.parseFloat(String(val))) && Number.isFinite(Number(val));

export const Sider = forwardRef<HTMLElement, SiderProps>((props, ref) => {
  const {
    className,
    style,
    children,
    width = 200,
    collapsedWidth = 80,
    collapsible = false,
    collapsed: controlledCollapsed,
    defaultCollapsed = false,
    onCollapse,
    theme = "dark",
    ...rest
  } = props;

  const { addSider, removeSider } = useContext(LayoutContext);
  const [innerCollapsed, setInnerCollapsed] = useState(defaultCollapsed);

  const collapsed = controlledCollapsed ?? innerCollapsed;

  useEffect(() => {
    addSider();
    return () => removeSider();
  }, []);

  const handleToggle = () => {
    const next = !collapsed;
    if (controlledCollapsed === undefined) {
      setInnerCollapsed(next);
    }
    onCollapse?.(next);
  };

  const rawWidth = collapsed ? collapsedWidth : width;
  const siderWidth = isNumeric(rawWidth) ? `${rawWidth}px` : String(rawWidth);

  return (
    <aside
      ref={ref}
      className={clsx(
        styles.sider,
        theme === "light" ? styles.siderLight : styles.siderDark,
        className,
      )}
      style={{
        ...style,
        flex: `0 0 ${siderWidth}`,
        width: siderWidth,
        maxWidth: siderWidth,
        minWidth: siderWidth,
      }}
      {...rest}
    >
      <div className={styles.siderChildren}>{children}</div>
      {collapsible && (
        <div className={styles.siderTrigger} onClick={handleToggle}>
          {collapsed ? "▶" : "◀"}
        </div>
      )}
    </aside>
  );
});

Sider.displayName = "Sider";

// ---- Compound Component ----

type InternalLayoutType = typeof InternalLayout;

type CompoundedComponent = InternalLayoutType & {
  Header: typeof Header;
  Footer: typeof Footer;
  Content: typeof Content;
  Sider: typeof Sider;
};

const Layout = InternalLayout as CompoundedComponent;

Layout.Header = Header;
Layout.Footer = Footer;
Layout.Content = Content;
Layout.Sider = Sider;

export default Layout;
