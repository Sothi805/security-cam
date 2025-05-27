import 'package:flutter/material.dart';
import 'package:better_player/better_player.dart';

void main() => runApp(MaterialApp(home: StreamPlayer()));

class StreamPlayer extends StatefulWidget {
  @override
  _StreamPlayerState createState() => _StreamPlayerState();
}

class _StreamPlayerState extends State<StreamPlayer> {
  late BetterPlayerController _controller;

  @override
  void initState() {
    super.initState();
    _controller = BetterPlayerController(
      BetterPlayerConfiguration(autoPlay: true),
      betterPlayerDataSource: BetterPlayerDataSource(
        BetterPlayerDataSourceType.network,
        'https://sequence-productivity-cruises-gym.trycloudflare.com/hls/102/index.m3u8',
        liveStream: true,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BetterPlayer(controller: _controller),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
} 