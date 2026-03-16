import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackTag } from '@codinator/contracts'; // 💡 공용 패키지 연결 테스트!

export default function App() {
  const exampleTag: FeedbackTag = FeedbackTag.FIT_PERFECT;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Codinator Mobile</Text>
      <Text>모바일 앱 뼈대 생성이 완료되었습니다!</Text>
      <Text style={styles.tagText}>테스트 태그: {exampleTag}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2563eb',
  },
  tagText: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    fontFamily: 'monospace',
  }
});