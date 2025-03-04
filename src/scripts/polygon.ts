import { point, booleanPointInPolygon } from "@turf/turf";


/**
 * Alternative version that returns the entire feature instead of just the properties
 * 
 * @param featureCollection Any GeoJSON-like feature collection
 * @param latLng Object with lat and lng properties
 * @returns Array of features containing the point
 */
export function findPolygonFeaturesAtPoint(
  featureCollection: any,
  latLng: {lat: number, lng: number}
): any[] {
  const tPoint = point([latLng.lng, latLng.lat]);
  const result: any[] = [];
  
  const features = featureCollection.features || 
                   (featureCollection.type === 'Feature' ? [featureCollection] : []);
  
  for (const feature of features) {
    if (!feature.geometry) continue;
    
    const geomType = feature.geometry.type;
    if (geomType !== 'Polygon' && geomType !== 'MultiPolygon') {
      continue;
    }
    
    try {
      const isInside = booleanPointInPolygon(tPoint, feature);
      
      if (isInside) {
        result.push(feature);
      }
    } catch (error) {
      console.error('Error checking if point is in polygon:', error);
    }
  }
  
  return result;
}