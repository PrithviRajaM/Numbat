import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSizes, layout, spacing } from '@/theme';

/**
 * Top navigation replicating the MyTeamGE template:
 *  - a dark header bar containing the logo
 */
export function Header() {
  return (
    <View style={styles.wrapper}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <View style={styles.headerBarInner}>
          <View style={styles.logoWrap}>
            <Text style={styles.logoMark}>my</Text>
            <Text style={styles.logoText}>TeamGE Local Bots</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    backgroundColor: colors.headerBar,
  },
  headerBar: {
    width: '100%',
    alignItems: 'center',
  },
  headerBarInner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoMark: {
    color: colors.brandLime,
    fontSize: fontSizes.xl,
    fontWeight: '800',
  },
  logoText: {
    color: colors.textOnDark,
    fontSize: fontSizes.xl,
    fontWeight: '800',
  },
});
