import styles from "./Breadcrumb.module.css";

export interface BreadcrumbItem {
  name: string;
  href: string;
}

export interface BreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

function buildBreadcrumbs(path: string): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [{ name: "Home", href: "/" }];
  const parts = path.split("/").filter((s) => s.length > 0);
  let accumulated = "";
  for (const part of parts) {
    accumulated += `/${part}`;
    crumbs.push({ name: decodeURIComponent(part), href: accumulated });
  }
  return crumbs;
}

export function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  const breadcrumbs = buildBreadcrumbs(path);
  return (
    <nav className={styles.breadcrumb}>
      {breadcrumbs.map((crumb, i) => (
        <span key={crumb.href} className={styles.item}>
          {i > 0 && <span className={styles.separator}>/</span>}
          {i === breadcrumbs.length - 1 ? (
            <span className={styles.current}>{crumb.name}</span>
          ) : (
            <button
              className={styles.link}
              onClick={() => onNavigate(crumb.href)}
            >
              {crumb.name}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}
