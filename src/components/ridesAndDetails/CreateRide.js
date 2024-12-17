import React, { useState, useEffect } from 'react';
import { Button, Form, Alert, Spinner, Container } from 'react-bootstrap';
import { createRide } from '../../api/rideApi';
import AutocompleteSearch from '../generalComponents/locationBlock.js';
import axios from 'axios';

const CreateRide = () => {
  const [rideData, setRideData] = useState({
    startLocation: '',
    endLocation: '',
    rideDate: '',
    rideTime: '',
    availableSeats: 1,
    startCoords: null,
    endCoords: null,
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [distance, setDistance] = useState(null);
  const [priceEstimate, setPriceEstimate] = useState(null);

  const baseFarePerKm = 13; // ₹13 per km

  // Traffic and road condition multipliers
  const trafficMultipliers = { light: 1, moderate: 1.2, heavy: 1.5 };
  const roadTypeMultipliers = { highway: 1, city: 1.3 };

  // Fetch Coordinates
  const fetchCoordinates = async (address, type) => {
    try {
      const response = await axios.get(
        'https://nominatim.openstreetmap.org/search',
        {
          params: { q: address, format: 'json', limit: 1 },
        }
      );

      if (response.data.length > 0) {
        const { lat, lon } = response.data[0];
        setRideData((prev) => ({
          ...prev,
          [type === 'start' ? 'startCoords' : 'endCoords']: { lat, lon },
        }));
      }
    } catch (error) {
      console.error('Error fetching coordinates:', error);
    }
  };

  // Calculate Distance
  const calculateDistance = async () => {
    if (!rideData.startCoords || !rideData.endCoords) return;

    const { startCoords, endCoords } = rideData;

    try {
      setIsLoading(true);
      const response = await axios.get(
        'https://api.openrouteservice.org/v2/directions/driving-car',
        {
          params: {
            api_key: '5b3ce3597851110001cf62483628cb4427c2430b96c354f4d63058fd',
            start: `${startCoords.lon},${startCoords.lat}`,
            end: `${endCoords.lon},${endCoords.lat}`,
          },
        }
      );

      const distanceInMeters =
        response.data.features[0].properties.segments[0].distance;
      const distanceInKm = (distanceInMeters / 1000).toFixed(2);

      setDistance(distanceInKm);
      calculatePriceEstimate(distanceInKm);
    } catch (error) {
      console.error('Error calculating distance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate Price Estimate
  const calculatePriceEstimate = (distance) => {
    const trafficMultiplier = trafficMultipliers['moderate']; // Example: moderate traffic
    const roadTypeMultiplier = roadTypeMultipliers['highway'];

    const basePrice = distance * baseFarePerKm;
    const finalPrice = basePrice * trafficMultiplier * roadTypeMultiplier;

    setPriceEstimate(finalPrice.toFixed(2));
  };

  // Handle Input Changes
  const handleChange = (e) => {
    setRideData({ ...rideData, [e.target.name]: e.target.value });
  };

  // Handle Location Selection
  const handleSelectLocation = (value, fieldName) => {
    setRideData({ ...rideData, [fieldName]: value });
    fetchCoordinates(value, fieldName === 'startLocation' ? 'start' : 'end');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    // Convert price to a float and validate it
    const priceInNumber = parseFloat(priceEstimate);
    if (isNaN(priceInNumber)) {
      setErrorMessage('Invalid price estimate');
      setIsLoading(false);
      return;
    }

    // Combine rideDate and rideTime into ISO format
    const rideDateTime = new Date(
      `${rideData.rideDate}T${rideData.rideTime}:00Z`
    );

    // Clean up the object to only include necessary fields
    const cleanedRideData = {
      startLocation: rideData.startLocation,
      endLocation: rideData.endLocation,
      rideDate: rideData.rideDate, // Still send the rideDate separately
      rideTime: rideDateTime.toISOString(), // ISO string for rideTime
      availableSeats: parseInt(rideData.availableSeats, 10), // Ensure availableSeats is a number
      price: priceInNumber, // Ensure price is a number
    };

    console.log('Submitting cleaned ride data:', cleanedRideData);

    try {
      // Call the backend API with the cleaned data
      const newRide = await createRide(cleanedRideData);
      setIsLoading(false);
      setSuccessMessage('Ride created successfully!');
    } catch (error) {
      setIsLoading(false);
      setErrorMessage(
        error.response?.data?.message || 'An unexpected error occurred'
      );
    }
  };

  useEffect(() => {
    if (rideData.startCoords && rideData.endCoords) {
      calculateDistance();
    }
  }, [rideData.startCoords, rideData.endCoords]);

  return (
    <div>
      <h3>Create a Ride</h3>
      {successMessage && <Alert variant='success'>{successMessage}</Alert>}
      {errorMessage && <Alert variant='danger'>{errorMessage}</Alert>}

      <Form onSubmit={handleSubmit}>
        <Form.Group controlId='startLocation'>
          <Form.Label>Start Location</Form.Label>
          <AutocompleteSearch
            fieldName='startLocation'
            value={rideData.startLocation}
            onSelectLocation={handleSelectLocation}
          />
        </Form.Group>

        <Form.Group controlId='endLocation'>
          <Form.Label>End Location</Form.Label>
          <AutocompleteSearch
            fieldName='endLocation'
            value={rideData.endLocation}
            onSelectLocation={handleSelectLocation}
          />
        </Form.Group>

        <Form.Group controlId='rideDate'>
          <Form.Label>Ride Date</Form.Label>
          <Form.Control
            type='date'
            name='rideDate'
            onChange={handleChange}
            required
          />
        </Form.Group>

        <Form.Group controlId='rideTime'>
          <Form.Label>Ride Time</Form.Label>
          <Form.Control
            type='time'
            name='rideTime'
            onChange={handleChange}
            required
          />
        </Form.Group>

        <Form.Group controlId='availableSeats'>
          <Form.Label>Seats Available</Form.Label>
          <Form.Control
            type='number'
            name='availableSeats'
            min='1'
            value={rideData.availableSeats}
            onChange={handleChange}
          />
        </Form.Group>

        {distance && <p>Distance: {distance} km</p>}
        {priceEstimate && <p>Price Estimate: ₹{priceEstimate}</p>}
        {isLoading && <Spinner animation='border' />}

        <Button type='submit' variant='primary' disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Ride'}
        </Button>
      </Form>
    </div>
  );
};

export default CreateRide;

// import React, { useState, useEffect } from 'react';
// import { Button, Form, Alert, Spinner, Container } from 'react-bootstrap';
// import { createRide } from '../../api/rideApi';
// import AutocompleteSearch from '../generalComponents/locationBlock.js'; // Import the AutocompleteSearch component
// import axios from 'axios';

// const CreateRide = () => {
//   const [rideData, setRideData] = useState({
//     startLocation: '',
//     endLocation: '',
//     rideDate: '',
//     rideTime: '', // Added rideTime field
//     availableSeats: 1,
//     startCoords: null,
//     endCoords: null,
//   });

//   const [startLocation, setStartLocation] = useState('');
//   const [endLocation, setEndLocation] = useState('');

//   const [errorMessage, setErrorMessage] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [successMessage, setSuccessMessage] = useState('');
//   const [distance, setDistance] = useState(null); // To hold the distance
//   const [priceEstimate, setPriceEstimate] = useState(null); // To hold the price estimate in INR

//   useEffect(() => {
//     if (rideData.startCoords && rideData.endCoords) {
//       console.log(
//         'Coordinates Ready:',
//         rideData.startCoords,
//         rideData.endCoords
//       );
//       calculateDistance();
//     }
//   }, [rideData.startCoords, rideData.endCoords]);

//   const baseFarePerKm = 13; // ₹12 per km for Indian roads

//   // Traffic conditions multipliers (for Indian roads)
//   const trafficMultipliers = {
//     light: 1,
//     moderate: 1.2,
//     heavy: 1.5,
//   };

//   // Road type multipliers (for Indian roads)
//   const roadTypeMultipliers = {
//     highway: 1,
//     city: 1.3,
//   };

//   // Handle input change
//   const handleChange = (e) => {
//     setRideData({
//       ...rideData,
//       [e.target.name]: e.target.value,
//     });
//   };

//   // Fetch coordinates for the selected location using Nominatim API
//   const fetchCoordinates = async (address, type) => {
//     try {
//       const response = await axios.get(
//         'https://nominatim.openstreetmap.org/search',
//         {
//           params: {
//             q: address,
//             format: 'json',
//             addressdetails: 1,
//             limit: 1,
//           },
//         }
//       );
//       if (response.data.length > 0) {
//         const { lat, lon } = response.data[0];
//         if (type === 'start') {
//           setRideData((prevState) => ({
//             ...prevState,
//             startCoords: { lat, lon },
//           }));
//         } else if (type === 'end') {
//           setRideData((prevState) => ({
//             ...prevState,
//             endCoords: { lat, lon },
//           }));
//         }
//       }
//     } catch (error) {
//       console.error('Error fetching coordinates:', error);
//     }
//   };

//   // Handle location selection
//   const handleSelectLocation = (value, fieldName) => {
//     setRideData({
//       ...rideData,
//       [fieldName]: value,
//     });

//     if (fieldName === 'startLocation') {
//       fetchCoordinates(value, 'start');
//       setStartLocation(value);
//     } else if (fieldName === 'endLocation') {
//       fetchCoordinates(value, 'end');
//       setEndLocation(value);
//     }
//   };

//   // Calculate the distance between start and end locations using OpenRouteService
//   useEffect(() => {
//     if (rideData.startCoords && rideData.endCoords) {
//       const { startCoords, endCoords } = rideData;

//       const calculateDistance = async () => {
//         console.log('calculateDistance called');
//         setIsLoading(true);
//         try {
//           const response = await axios.get(
//             'https://api.openrouteservice.org/v2/directions/driving-car',
//             {
//               params: {
//                 api_key:
//                   '5b3ce3597851110001cf62483628cb4427c2430b96c354f4d63058fd', // Replace with your OpenRouteService API Key
//                 start: `${startCoords.lon},${startCoords.lat}`,
//                 end: `${endCoords.lon},${endCoords.lat}`,
//               },
//             }
//           );
//           const distanceInMeters =
//             response.data.features[0].properties.segments[0].distance;
//           setDistance((distanceInMeters / 1000).toFixed(2)); // Convert to km
//           setIsLoading(false);

//           // Calculate price estimate
//           calculatePriceEstimate(distanceInMeters / 1000); // Pass distance in km
//         } catch (error) {
//           console.error('Error calculating distance:', error);
//           setIsLoading(false);
//         }
//       };

//       calculateDistance(); // Ensure this function is called
//     }
//   }, [rideData.startCoords, rideData.endCoords]);

//   // Function to calculate price estimate in INR
//   const calculatePriceEstimate = (distance) => {
//     // Determine traffic condition (this can be an input or calculated based on time of day)
//     const trafficCondition = 'moderate'; // Example (this can be dynamic based on real data)
//     const roadType = 'highway'; // Example (this can be dynamic based on the route)

//     // Get the respective multipliers
//     const trafficMultiplier = trafficMultipliers[trafficCondition];
//     const roadTypeMultiplier = roadTypeMultipliers[roadType];

//     // Calculate the base fare based on distance
//     const basePrice = distance * baseFarePerKm;

//     // Adjust the price based on traffic and road type
//     const estimatedPriceINR =
//       basePrice * trafficMultiplier * roadTypeMultiplier;

//     setPriceEstimate(estimatedPriceINR.toFixed(2)); // Set price in INR
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setErrorMessage('');
//     setSuccessMessage('');
//     setIsLoading(true);

//     // Ensure the price is a number, not a string
//     const priceInNumber = parseFloat(priceEstimate); // Convert price to number

//     if (isNaN(priceInNumber)) {
//       setErrorMessage('Invalid price estimate');
//       setIsLoading(false);
//       return;
//     }

//     try {
//       // Add the price to rideData
//       const { startCoords, endCoords, ...rideToCreate } = {
//         ...rideData,
//         price: priceInNumber, // Set price as a number
//         startLocation: startLocation, // Ensure startLocation is included
//         endLocation: endLocation, // Ensure endLocation is included
//       };

//       console.log(rideToCreate);
//       const newRide = await createRide(rideToCreate);
//       setIsLoading(false);
//       setSuccessMessage('Ride created successfully!');
//     } catch (error) {
//       setIsLoading(false);
//       setErrorMessage(error.message || 'An unexpected error occurred');
//     }
//   };

//   return (
//     <div>
//       <h3>Create a Ride</h3>
//       {successMessage && <Alert variant='success'>{successMessage}</Alert>}
//       {errorMessage && <Alert variant='danger'>{errorMessage}</Alert>}

//       <Form onSubmit={handleSubmit}>
//         {/* Start Location */}
//         <Form.Group controlId='startLocation'>
//           <Form.Label>Start Location</Form.Label>
//           <AutocompleteSearch
//             fieldName='startLocation'
//             value={rideData.startLocation}
//             onSelectLocation={handleSelectLocation}
//           />
//         </Form.Group>

//         {/* End Location */}
//         <Form.Group controlId='endLocation'>
//           <Form.Label>End Location</Form.Label>
//           <AutocompleteSearch
//             fieldName='endLocation'
//             value={rideData.endLocation}
//             onSelectLocation={handleSelectLocation}
//           />
//         </Form.Group>

//         {/* Ride Date */}
//         <Form.Group controlId='rideDate'>
//           <Form.Label>Ride Date</Form.Label>
//           <Form.Control
//             type='date'
//             name='rideDate'
//             value={rideData.rideDate}
//             onChange={handleChange}
//             required
//           />
//         </Form.Group>
//         {/* Ride Time */}
//         <Form.Group controlId='rideTime'>
//           <Form.Label>Ride Time</Form.Label>
//           <Form.Control
//             type='time'
//             name='rideTime'
//             value={rideData.rideTime}
//             onChange={handleChange}
//             required
//           />
//         </Form.Group>

//         {/* Available Seats */}
//         <Form.Group controlId='availableSeats'>
//           <Form.Label>Seats Available</Form.Label>
//           <Form.Control
//             type='number'
//             name='availableSeats'
//             value={rideData.availableSeats}
//             onChange={handleChange}
//             required
//             min='1'
//           />
//         </Form.Group>
//         <Container className='mt-3'>
//           {/* Distance */}
//           {distance && !isLoading && (
//             <div>
//               <strong>Distance:</strong> {distance} km
//             </div>
//           )}

//           {/* Price Estimate in INR */}
//           {priceEstimate && !isLoading && (
//             <div>
//               <strong>Cost Estimate:</strong> ₹{priceEstimate}
//             </div>
//           )}
//         </Container>
//         {isLoading && <Spinner animation='border' />}

//         {/* Submit Button */}
//         <Button type='submit' variant='primary' disabled={isLoading}>
//           {isLoading ? (
//             <Spinner as='span' animation='border' size='sm' />
//           ) : (
//             'Create Ride'
//           )}
//         </Button>
//       </Form>
//     </div>
//   );
// };

// export default CreateRide;
