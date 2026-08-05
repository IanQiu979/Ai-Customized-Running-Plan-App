import { IntakeExitAction } from '../../components/intake/IntakeExitAction';

describe('IntakeExitAction', () => {
  it('is always an explicit, accessible way to leave intake', () => {
    const onPress = jest.fn();
    const action = IntakeExitAction({ color: '#000', onPress });

    expect(action.props.accessibilityLabel).toBe('Skip intake for now');
    expect(action.props.accessibilityRole).toBe('button');

    action.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
