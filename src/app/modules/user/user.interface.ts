/* eslint-disable @typescript-eslint/consistent-type-definitions */

export type SocialLinks = {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    website?: string;
}

export type EmergencyContact = {
    name: string;
    phone: string;
    relation: string;
}

export type PreferenceSettings = {
    theme?: 'light' | 'dark';
    notifications?: boolean;
    language?: string;
}

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
    socialLinks?: SocialLinks;
    achievements?: string[];
    languages?: string[];
    emergencyContact?: EmergencyContact;
    favorites?: string[];
    preferenceSettings?: PreferenceSettings;
}

export type createAdminInput = {
    name: string;
    email: string;
    password: string;
    profilePhoto?: string;
    contactNumber?: string;
    socialLinks?: SocialLinks;
    preferenceSettings?: PreferenceSettings;
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
    socialLinks?: SocialLinks;
    achievements?: string[];
    languages?: string[];
    emergencyContact?: EmergencyContact;
    favorites?: string[];
    preferenceSettings?: PreferenceSettings;
    followerCount?: number;
}