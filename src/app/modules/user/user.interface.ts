/* eslint-disable @typescript-eslint/consistent-type-definitions */
export type createTouristInput = {
    name: string;
    email: string;
    password: string;
    profilePhoto?: string;
    bio?: string;
    interests?: string;
    location?: string;
    contactNumber?: string;
    visitedCountries?: string;
}

export type createAdminInput = {
    name: string;
    email: string;
    password: string;
    profilePhoto?: string;
    contactNumber?: string;
}

export type createHostInput = {
    name: string;
    email: string;
    password: string;
    profilePhoto?: string;
    phone?: string;
    bio?: string;
    hometown?: string;
    visitedLocations?: string[];
}