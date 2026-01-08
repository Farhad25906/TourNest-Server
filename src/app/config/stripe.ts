import Stripe from "stripe";

// Debug: Check if env variable is loaded
// console.log("Stripe key exists:", !!process.env.STRIPE_SECRET_KEY);

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
}
// console.log(process.env.STRIPE_SECRET_KEY);


export const stripe = new Stripe(
    process.env.STRIPE_SECRET_KEY
    // {
    //     apiVersion: "2024-04-10",
    // }
);