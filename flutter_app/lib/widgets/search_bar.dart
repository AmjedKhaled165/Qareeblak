import 'package:flutter/material.dart';

class CustomSearchBar extends StatefulWidget {
  const CustomSearchBar({Key? key}) : super(key: key);

  @override
  State<CustomSearchBar> createState() => _CustomSearchBarState();
}

class _CustomSearchBarState extends State<CustomSearchBar> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF4F46E5).withOpacity(0.05),
            const Color(0xFF6366F1).withOpacity(0.03),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFF4F46E5).withOpacity(0.1),
        ),
      ),
      child: TextField(
        controller: _controller,
        decoration: InputDecoration(
          hintText: 'بتدور على إيه؟',
          prefixIcon: const Icon(Icons.search),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 12),
          suffix: _controller.text.isNotEmpty
              ? GestureDetector(
                  onTap: () {
                    _controller.clear();
                    setState(() {});
                  },
                  child: const Padding(
                    padding: EdgeInsets.only(right: 8),
                    child: Icon(Icons.close, size: 18),
                  ),
                )
              : null,
        ),
        onChanged: (value) {
          setState(() {});
        },
      ),
    );
  }
}
