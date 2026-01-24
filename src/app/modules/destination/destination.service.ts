import { prisma } from '../../shared/prisma';
import { IDestination } from './destination.interface';

const createDestination = async (payload: IDestination): Promise<IDestination> => {
    const result = await prisma.destination.create({
        data: payload,
    });
    return result;
};

const getAllDestinations = async (query: any): Promise<IDestination[]> => {
    const { searchTerm, isFeatured } = query;

    const whereCondition: any = {};

    if (searchTerm) {
        whereCondition.OR = [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
        ];
    }

    if (isFeatured !== undefined) {
        whereCondition.isFeatured = isFeatured === 'true';
    }

    const result = await prisma.destination.findMany({
        where: whereCondition,
        orderBy: {
            createdAt: 'desc'
        }
    });

    return result;
};

const getSingleDestination = async (id: string): Promise<IDestination | null> => {
    const result = await prisma.destination.findUnique({
        where: { id },
    });
    return result;
};

const updateDestination = async (
    id: string,
    payload: Partial<IDestination>
): Promise<IDestination | null> => {
    const result = await prisma.destination.update({
        where: { id },
        data: payload,
    });
    return result;
};

const deleteDestination = async (id: string): Promise<IDestination | null> => {
    const result = await prisma.destination.delete({
        where: { id },
    });
    return result;
};

export const DestinationService = {
    createDestination,
    getAllDestinations,
    getSingleDestination,
    updateDestination,
    deleteDestination,
};
