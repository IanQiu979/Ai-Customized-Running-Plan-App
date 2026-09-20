import { IntakeExitAction } from '../../components/intake/IntakeExitAction';

describe('IntakeExitAction', () => {
  it('is an explicit, accessible way to leave a re-entered intake', () => {
    const onPress = jest.fn();
    const action = IntakeExitAction({ color: '#000', onPress, label: 'Cancel' });

    expect(action.props.accessibilityLabel).toBe('Cancel');
    expect(action.props.accessibilityRole).toBe('button');

    action.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
