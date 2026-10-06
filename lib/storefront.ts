export const formatNaira = (amount: number) =>
  `₦${amount.toLocaleString("en-NG")}`;

export const toProductSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
