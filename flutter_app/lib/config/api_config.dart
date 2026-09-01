// API Configuration
class ApiConfig {
  // Base URLs
  static const String baseUrl = 'http://localhost:5000/api';
  static const String webSocketUrl = 'http://localhost:5000';

  // Endpoints
  static const String loginEndpoint = '/auth/login';
  static const String registerEndpoint = '/auth/register';
  static const String categoriesEndpoint = '/categories';
  static const String servicesEndpoint = '/services';
  static const String ordersEndpoint = '/orders';
  static const String chatEndpoint = '/chat';

  // Timeouts
  static const int connectTimeout = 10000; // 10 seconds
  static const int receiveTimeout = 10000; // 10 seconds

  // Headers
  static Map<String, String> get headers {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }
}

// Firebase Configuration
class FirebaseConfig {
  static const String projectId = 'qareeblak-810d3';
  static const String apiKey = 'YOUR_API_KEY';
  static const String appId = 'YOUR_APP_ID';
  static const String messagingSenderId = 'YOUR_MESSAGING_SENDER_ID';
}

// App Configuration
class AppConfig {
  static const String appName = 'قريبلك';
  static const String appVersion = '1.0.0';
  static const bool debugMode = true;
}
