import { Suspense } from "react";
import TreeClient from "./tree-client";

export default function TreePage() {
  return (
    <Suspense>
      <TreeClient />
    </Suspense>
  );
}
