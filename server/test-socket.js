const { io } = require('socket.io-client');

const courierSocket = io('https://api.qareeblak.com', {
    transports: ['websocket', 'polling']
});

courierSocket.on('connect_error', (err) => {
    console.log('Courier connect_error:', err.message);
});

courierSocket.on('connect', () => {
    console.log('Courier connected:', courierSocket.id);
    const locationData = {
        driverId: 25,
        courierId: 25,
        name: 'سيف',
        lat: 27.269,
        lng: 31.307,
        latitude: 27.269,
        longitude: 31.307,
        speed: 10,
        heading: 90,
        accuracy: 5,
        timestamp: Date.now()
    };
    courierSocket.emit('driver-online', 25);
    courierSocket.emit('driver-location', locationData);
    courierSocket.emit('sendLocation', locationData);
    console.log('Courier emitted location');

    const managerSocket = io('https://api.qareeblak.com', {
        transports: ['websocket', 'polling']
    });

    managerSocket.on('connect_error', (err) => {
        console.log('Manager connect_error:', err.message);
    });

    managerSocket.on('connect', () => {
        console.log('Manager connected:', managerSocket.id);
        
        managerSocket.on('updateLocation', (data) => {
            console.log('Manager received updateLocation:', data);
        });

        managerSocket.emit('join-driver-tracking', "25");
        console.log('Manager requested join-driver-tracking for 25');

        setTimeout(() => {
            managerSocket.emit('join-managers');
            console.log('Manager requested join-managers');
        }, 3000);

        setTimeout(() => {
            console.log('Testing done. Disconnecting...');
            courierSocket.disconnect();
            managerSocket.disconnect();
        }, 6000);
    });
});
