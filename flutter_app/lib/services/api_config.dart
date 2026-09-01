class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:3000/api',
  );
  static const int receiveTimeout = 15000;
  static const int connectTimeout = 15000;
  static const Map<String, dynamic> headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  
  // Endpoints
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String services = '/services';
  static const String categories = '/categories';
  static const String profile = '/profile';
}
