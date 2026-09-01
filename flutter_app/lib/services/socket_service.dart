import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../config/api_config.dart';
import 'auth_service.dart';

class SocketService {
  static final SocketService _instance = SocketService._internal();
  IO.Socket? _socket;
  final AuthService _authService = AuthService();

  factory SocketService() {
    return _instance;
  }

  SocketService._internal();

  IO.Socket? get socket => _socket;

  Future<void> connect() async {
    if (_socket != null && _socket!.connected) return;

    final token = await _authService.getToken();

    _socket = IO.io(ApiConfig.webSocketUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'extraHeaders': {
        if (token != null) 'Authorization': 'Bearer $token',
      },
    });

    _socket!.connect();

    _socket!.onConnect((_) {
      print('🚀 Socket Connected');
    });

    _socket!.onDisconnect((_) {
      print('🛑 Socket Disconnected');
    });

    _socket!.onConnectError((data) {
      print('❌ Socket Connect Error: $data');
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }

  void on(String event, Function(dynamic) handler) {
    _socket?.on(event, handler);
  }

  void off(String event) {
    _socket?.off(event);
  }

  void emit(String event, dynamic data) {
    _socket?.emit(event, data);
  }
}
