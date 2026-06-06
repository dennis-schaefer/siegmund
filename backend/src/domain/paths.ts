export function computeEntryPath(area: string, id: string): string {
  if (area === 'inbox') {
    return `/inbox/${id}.md`;
  }
  return `/areas/${area}/entries/${id}.md`;
}

export function computeHubPath(areaSlug: string): string {
  return `/areas/${areaSlug}/_hub.md`;
}

export function computeAreasIndexPath(): string {
  return '/_areas.md';
}
