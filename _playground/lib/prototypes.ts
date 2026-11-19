import "server-only";
export { prototypes, published } from "./registry.generated";
export interface Prototype {
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
  public: boolean;
  slug: string;
  preview: boolean;
}
