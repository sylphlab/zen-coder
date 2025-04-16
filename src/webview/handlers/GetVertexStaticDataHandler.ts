import { RequestHandler } from './RequestHandler';

// Define LocationWithRegion interface here or import if defined elsewhere
interface LocationWithRegion {
    id: string;
    name: string;
    region: string;
}

interface VertexStaticData {
    projects: { id: string; name: string }[];
    locations: LocationWithRegion[]; // Use LocationWithRegion here
}

// Static list based on user provided data with region
const staticVertexLocations: LocationWithRegion[] = [
    // Africa
    { id: 'africa-south1', name: 'Johannesburg, South Africa', region: 'Africa' },
    // Asia Pacific
    { id: 'asia-east1', name: 'Changhua County, Taiwan', region: 'Asia Pacific' },
    { id: 'asia-east2', name: 'Hong Kong', region: 'Asia Pacific' },
    { id: 'asia-northeast1', name: 'Tokyo, Japan', region: 'Asia Pacific' },
    { id: 'asia-northeast2', name: 'Osaka, Japan', region: 'Asia Pacific' },
    { id: 'asia-northeast3', name: 'Seoul, South Korea', region: 'Asia Pacific' },
    { id: 'asia-south1', name: 'Mumbai, India', region: 'Asia Pacific' },
    { id: 'asia-southeast1', name: 'Jurong West, Singapore', region: 'Asia Pacific' },
    { id: 'asia-southeast2', name: 'Jakarta, Indonesia', region: 'Asia Pacific' },
    { id: 'australia-southeast1', name: 'Sydney, Australia', region: 'Asia Pacific' },
    { id: 'australia-southeast2', name: 'Melbourne, Australia', region: 'Asia Pacific' },
    // Europe
    { id: 'europe-central2', name: 'Warsaw, Poland', region: 'Europe' },
    { id: 'europe-north1', name: 'Hamina, Finland (Low CO2)', region: 'Europe' },
    { id: 'europe-southwest1', name: 'Madrid, Spain (Low CO2)', region: 'Europe' },
    { id: 'europe-west1', name: 'St. Ghislain, Belgium (Low CO2)', region: 'Europe' },
    { id: 'europe-west2', name: 'London, England (Low CO2)', region: 'Europe' },
    { id: 'europe-west3', name: 'Frankfurt, Germany (Low CO2)', region: 'Europe' },
    { id: 'europe-west4', name: 'Eemshaven, Netherlands (Low CO2)', region: 'Europe' },
    { id: 'europe-west6', name: 'Zürich, Switzerland (Low CO2)', region: 'Europe' },
    { id: 'europe-west8', name: 'Milan, Italy', region: 'Europe' },
    { id: 'europe-west9', name: 'Paris, France (Low CO2)', region: 'Europe' },
    { id: 'europe-west12', name: 'Turin, Italy', region: 'Europe' },
    // Middle East
    { id: 'me-central1', name: 'Doha, Qatar', region: 'Middle East' },
    { id: 'me-central2', name: 'Damman, Saudi Arabia', region: 'Middle East' },
    { id: 'me-west1', name: 'Tel Aviv, Israel', region: 'Middle East' },
    // North America
    { id: 'northamerica-northeast1', name: 'Montréal, Québec, Canada (Low CO2)', region: 'North America' },
    { id: 'northamerica-northeast2', name: 'Toronto, Ontario, Canada (Low CO2)', region: 'North America' },
    { id: 'us-central1', name: 'Council Bluffs, Iowa, USA (Low CO2)', region: 'North America' },
    { id: 'us-east1', name: 'Moncks Corner, South Carolina, USA', region: 'North America' },
    { id: 'us-east4', name: 'Ashburn, Virginia, USA', region: 'North America' },
    { id: 'us-east5', name: 'Columbus, Ohio, USA', region: 'North America' },
    { id: 'us-south1', name: 'Dallas, Texas, USA (Low CO2)', region: 'North America' },
    { id: 'us-west1', name: 'The Dalles, Oregon, USA (Low CO2)', region: 'North America' },
    { id: 'us-west2', name: 'Los Angeles, California, USA', region: 'North America' },
    { id: 'us-west3', name: 'Salt Lake City, Utah, USA', region: 'North America' },
    { id: 'us-west4', name: 'Las Vegas, Nevada, USA', region: 'North America' },
    // South America
    { id: 'southamerica-east1', name: 'Osasco, São Paulo, Brazil (Low CO2)', region: 'South America' },
    { id: 'southamerica-west1', name: 'Santiago, Chile (Low CO2)', region: 'South America' },
];


export class GetVertexStaticDataHandler implements RequestHandler<void, VertexStaticData> {
    readonly requestType = 'getVertexStaticData';

    async handle(_payload: void): Promise<VertexStaticData> {
        console.log('[GetVertexStaticDataHandler] Returning static Vertex data.');
        // Return static locations and an empty project list
        return {
            projects: [], // No static project data, return empty array
            locations: staticVertexLocations,
        };
    }
}