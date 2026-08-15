"use client";

import { switchBrand } from "./switch-brand";
import styles from "./page.module.css";

export interface BrandSwitcherOption {
  brandId: string;
  name: string;
}

/**
 * Top-of-sidebar workspace switcher — each Brand is a fully separate
 * "dashboard" (its own sources, clips, schedule, platform connections), so
 * this sits above the main nav rather than tucked into the topbar, making
 * which property you're in obvious at a glance and one click away to
 * change. Switches immediately on selection (no separate submit step).
 */
export default function BrandSwitcher({
  currentBrandId,
  currentBrandName,
  options,
}: {
  currentBrandId: string;
  currentBrandName: string;
  options: BrandSwitcherOption[];
}) {
  if (options.length <= 1) {
    return (
      <div className={styles.sidebarBrandPicker}>
        <span>Brand</span>
        <strong>{currentBrandName}</strong>
      </div>
    );
  }

  return (
    <form action={switchBrand} className={styles.sidebarBrandPicker}>
      <span>Brand</span>
      <select
        name="brandId"
        defaultValue={currentBrandId}
        aria-label="Current brand"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {options.map((option) => (
          <option key={option.brandId} value={option.brandId}>
            {option.name}
          </option>
        ))}
      </select>
    </form>
  );
}
