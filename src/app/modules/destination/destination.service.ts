import { Request } from 'express';
import { prisma } from '../../shared/prisma';
import { IDestination } from './destination.interface';
import { fileUploader } from '../../helper/fileUploader';

const createDestination = async (req: Request): Promise<IDestination> => {
    console.log('req.body:', req.body); // Debug: see what you're receiving

    let imageUrl = req.body.image || '';

    // Handle image upload if file is present
    if (req.file) {
        const uploadResult = await fileUploader.uploadToCloudinary(req.file);
        if (uploadResult?.secure_url) {
            imageUrl = uploadResult.secure_url;
        }
    }

    // If req.body has a data property, use that instead
    const requestData = req.body.data ? JSON.parse(req.body.data) : req.body;

    const destinationData = {
        ...requestData,
        image: imageUrl,
    };

    console.log('destinationData:', destinationData); // Debug: see what you're sending to Prisma

    const result = await prisma.destination.create({
        data: destinationData,
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
    req: Request
): Promise<IDestination | null> => {
    let imageUrl = req.body.image;

    // Handle image upload if file is present
    if (req.file) {
        const uploadResult = await fileUploader.uploadToCloudinary(req.file);
        if (uploadResult?.secure_url) {
            imageUrl = uploadResult.secure_url;
        }
    }

    // Parse data if it exists (common for multipart/form-data with file uploads)
    const requestData = req.body.data ? JSON.parse(req.body.data) : req.body;

    const updateData = {
        ...requestData,
    };

    if (imageUrl) {
        updateData.image = imageUrl;
    }

    // Remove fields that shouldn't be updated or might cause issues
    delete updateData.id;
    delete updateData.data;

    const result = await prisma.destination.update({
        where: { id },
        data: updateData,
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
