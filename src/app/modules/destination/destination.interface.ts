export type IDestination = {
    id: string;
    name: string;
    image: string;
    description?: string | null;
    isFeatured: boolean;
    createdAt: Date;
    updatedAt: Date;
};
